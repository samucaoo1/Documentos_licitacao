from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Provider:
    id: str
    title: str
    url: str
    prefix: str
    input_selectors: tuple[str, ...]
    result_phrases: tuple[str, ...] = ()
    printable_result: bool = False

    def filename(self, cnpj: str) -> str:
        return f"{self.prefix}-{self.id.upper()}-{cnpj}.pdf"

    def prepare_script(self, cnpj: str) -> str:
        selectors = json.dumps(self.input_selectors, ensure_ascii=False)
        value = json.dumps(cnpj)
        return f"""
(() => {{
  const selectors = {selectors};
  const value = {value};

  const find = () => {{
    for (const selector of selectors) {{
      const el = document.querySelector(selector);
      if (el) return el;
    }}

    return [...document.querySelectorAll('input:not([type=hidden])')].find(el => {{
      const text = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes('cnpj') || text.includes('cpf/cnpj');
    }}) || null;
  }};

  const input = find();
  if (!input) return {{filled: false}};

  if (!input.value) {{
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    );

    if (descriptor && descriptor.set) descriptor.set.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event('input', {{bubbles: true}}));
    input.dispatchEvent(new Event('change', {{bubbles: true}}));
    input.dispatchEvent(new Event('blur', {{bubbles: true}}));
  }}

  return {{filled: true}};
}})()
"""

    def inspect_script(self) -> str:
        phrases = json.dumps(
            tuple(phrase.lower() for phrase in self.result_phrases),
            ensure_ascii=False,
        )
        return f"""
(() => {{
  const body = (document.body?.innerText || '').toLowerCase();

  const token = document.querySelector(
    '[name="h-captcha-response"], [name="g-recaptcha-response"]'
  );

  const captchaFrame = document.querySelector(
    'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[title*="captcha" i]'
  );

  const captchaPresent = Boolean(captchaFrame || token) ||
    body.includes('não sou um robô') ||
    body.includes('captcha');

  const captchaSolved = Boolean(
    token?.value && token.value.trim().length > 10
  );

  const pdf = [...document.querySelectorAll('a[href]')].find(a =>
    /\.pdf(?:$|[?#])/i.test(a.href || '') ||
    (a.innerText || '').toLowerCase().includes('baixar pdf')
  );

  const phrases = {phrases};
  const resultReady =
    phrases.length > 0 && phrases.every(phrase => body.includes(phrase));

  return {{
    captcha_present: captchaPresent,
    captcha_solved: captchaSolved,
    pdf_url: pdf?.href || null,
    result_ready: resultReady,
    url: location.href
  }};
}})()
"""
