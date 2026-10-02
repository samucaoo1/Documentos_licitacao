import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL(".",import.meta.url));
const PORT=Number(process.env.PORT||8080);
const HOST=process.env.HOST||"0.0.0.0";

const urls={
  cnpj:"https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  fgts:"https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt:"https://www.tst.jus.br/certidao1",
  federal:"https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  mg:"https://www.fazenda.mg.gov.br/empresas/certidao_debitos/",
  tcu:"https://certidoes-apf.apps.tcu.gov.br/"
};

export function cleanCnpj(v=""){return String(v).toUpperCase().replace(/[^0-9A-Z]/g,"")}
export function formatCnpj(v){
  const c=cleanCnpj(v).slice(0,14);
  if(c.length<=2)return c;if(c.length<=5)return c.slice(0,2)+"."+c.slice(2);
  if(c.length<=8)return c.slice(0,2)+"."+c.slice(2,5)+"."+c.slice(5);
  if(c.length<=12)return c.slice(0,2)+"."+c.slice(2,5)+"."+c.slice(5,8)+"/"+c.slice(8);
  return c.slice(0,2)+"."+c.slice(2,5)+"."+c.slice(5,8)+"/"+c.slice(8,12)+"-"+c.slice(12);
}
export function validNumericCnpj(v){
  const c=cleanCnpj(v); if(!/^\d{14}$/.test(c)||/^(\d)\1{13}$/.test(c))return false;
  const calc=n=>{let f=n-7,t=0;for(const d of c.slice(0,n)){t+=Number(d)*f--;if(f===1)f=9}const r=t%11;return r<2?0:11-r};
  return calc(12)===Number(c[12])&&calc(13)===Number(c[13]);
}
export function acceptedCnpj(v){
  const c=cleanCnpj(v); if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(c))return false;
  return /^\d{14}$/.test(c)?validNumericCnpj(c):true;
}
async function getJson(url){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
  try{
    const r=await fetch(url,{signal:ctl.signal,headers:{"user-agent":"DocumentosLicitacao/0.2",accept:"application/json,*/*"}});
    const text=await r.text();let body;try{body=JSON.parse(text)}catch{body={raw:text}}
    if(!r.ok)throw new Error("HTTP "+r.status);return body;
  }finally{clearTimeout(timer)}
}
async function company(cnpj){return getJson("https://brasilapi.com.br/api/cnpj/v1/"+encodeURIComponent(cnpj))}
async function tcu(cnpj,pdf=false){
  if(!/^\d{14}$/.test(cnpj)){const e=new Error("TCU ainda documenta CNPJ numérico.");e.code="ALPHA";throw e}
  return getJson("https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/"+cnpj+"?seEmitirPDF="+pdf);
}
export function classifyTcu(data){
  const items=Array.isArray(data?.certidoes)?data.certidoes:[];
  const bad=items.filter(x=>{const s=(String(x?.situacao||"")+" "+String(x?.descricao||"")+" "+String(x?.observacao||"")).toLowerCase();
    return !(s.includes("nada consta")||s.includes("não consta")||s.includes("nao consta")||s.includes("regular")||s.includes("negativa"))});
  return {count:items.length,bad,items};
}
function manual(id,title,source,url,msg){return{id,title,source,status:"Ação no portal oficial",tone:"warning",message:msg,officialUrl:url,downloadable:false}}
async function consultation(cnpj,uf){
  const [cr,tr]=await Promise.allSettled([company(cnpj),tcu(cnpj,false)]);
  const cd=cr.status==="fulfilled"?cr.value:null,td=tr.status==="fulfilled"?tr.value:null;
  const info=cd?{razaoSocial:cd.razao_social||null,nomeFantasia:cd.nome_fantasia||null,municipio:cd.municipio||null,uf:cd.uf||null,situacao:cd.descricao_situacao_cadastral||null}:null;
  const docs=[];
  docs.push(cd?{id:"cnpj",title:"Dados cadastrais do CNPJ",source:"BrasilAPI / Minha Receita",status:cd.descricao_situacao_cadastral||"Consultado",tone:String(cd.descricao_situacao_cadastral||"").toUpperCase()==="ATIVA"?"success":"warning",message:"Consulta automática de dados públicos. Para habilitação, emita também o comprovante oficial.",officialUrl:urls.cnpj,downloadable:false}:manual("cnpj","Cartão / dados do CNPJ","Receita Federal",urls.cnpj,"Consulta auxiliar indisponível; use o portal oficial."));
  docs.push(manual("fgts","Regularidade do FGTS / CRF","CAIXA",urls.fgts,"A emissão deve ser concluída no portal oficial da CAIXA."));
  docs.push(manual("cndt","CNDT Trabalhista","TST",urls.cndt,"O TST exige CAPTCHA; a confirmação precisa ser feita pelo usuário."));
  docs.push(manual("federal","Regularidade Fiscal Federal","RFB / PGFN",urls.federal,"A emissão pública utiliza hCaptcha; use o portal oficial."));
  docs.push(uf==="MG"?manual("estadual","Certidão Estadual","SEF/MG",urls.mg,"CDT de Minas Gerais disponível no portal oficial."):{id:"estadual",title:"Certidão Estadual",source:"Fazenda Estadual / "+uf,status:"UF ainda não integrada",tone:"neutral",message:"Provider estadual ainda não implementado.",downloadable:false});
  if(td){const x=classifyTcu(td);docs.push({id:"sancoes",title:"Consulta Consolidada de Pessoa Jurídica",source:"TCU (API oficial)",status:x.bad.length?"Revisar ocorrências":"Consulta concluída",tone:x.bad.length?"danger":"success",message:x.bad.length?x.bad.length+" registro(s) merecem revisão.":x.count+" retorno(s) na consulta consolidada.",officialUrl:urls.tcu,downloadable:true,details:x.items})}
  else docs.push({id:"sancoes",title:"Consulta Consolidada de Pessoa Jurídica",source:"TCU",status:tr.reason?.code==="ALPHA"?"Aguardando suporte alfanumérico":"Consulta indisponível",tone:"warning",message:tr.reason?.message||"Falha ao consultar a API do TCU.",officialUrl:urls.tcu,downloadable:false});
  return {ok:true,cnpj,formattedCnpj:formatCnpj(cnpj),uf,company:info,documents:docs,consultedAt:new Date().toISOString()};
}
async function pdfResponse(cnpj,res){
  const data=await tcu(cnpj,true);
  const b64=data?.certidaoPDF||data?.pdfBase64||data?.pdf||data?.arquivo;
  if(typeof b64!=="string")throw new Error("O TCU não retornou PDF neste formato.");
  const buf=Buffer.from(b64.replace(/^data:application\/pdf;base64,/,""),"base64");
  res.writeHead(200,{"content-type":"application/pdf","content-disposition":'attachment; filename="consulta-tcu-'+cnpj+'.pdf"'});res.end(buf);
}
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
async function handler(req,res){
  const u=new URL(req.url,"http://localhost");
  try{
    if(u.pathname==="/api/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true}))}
    if(u.pathname==="/api/consulta"){
      const c=cleanCnpj(u.searchParams.get("cnpj")),uf=(u.searchParams.get("uf")||"").toUpperCase();
      if(!acceptedCnpj(c)){res.writeHead(400,{"content-type":"application/json"});return res.end(JSON.stringify({ok:false,error:"CNPJ inválido"}))}
      const out=await consultation(c,uf);res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify(out));
    }
    if(u.pathname==="/api/tcu/pdf")return await pdfResponse(cleanCnpj(u.searchParams.get("cnpj")),res);
    const path=u.pathname==="/"?"index.html":u.pathname.slice(1);
    const file=join(ROOT,path);const data=await readFile(file);res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream"});res.end(data);
  }catch(e){res.writeHead(500,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:e.message}))}
}
export const server=createServer(handler);
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(PORT,HOST,()=>console.log("http://"+HOST+":"+PORT));
