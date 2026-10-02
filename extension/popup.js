const api = globalThis.browser ?? globalThis.chrome;

document.querySelector("#openDashboard").addEventListener("click", async () => {
  await api.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
  window.close();
});
