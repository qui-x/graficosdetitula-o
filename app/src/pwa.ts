export {};

interface InstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
}

const installButton = document.getElementById("pwa-install-button");
const statusEl = document.getElementById("pwa-status");
let deferredPrompt: DeferredInstallPrompt | null = null;

function announce(message: string): void {
  if (statusEl) statusEl.textContent = message;
}

const standaloneQuery = window.matchMedia("(display-mode: standalone)");
if (standaloneQuery.matches) {
  if (installButton instanceof HTMLButtonElement) installButton.hidden = true;
}
standaloneQuery.addEventListener?.("change", (event) => {
  if (installButton instanceof HTMLButtonElement && event.matches) installButton.hidden = true;
});

window.addEventListener("beforeinstallprompt", (event: Event) => {
  event.preventDefault();
  deferredPrompt = event as DeferredInstallPrompt;
  if (installButton instanceof HTMLButtonElement) {
    installButton.hidden = false;
    installButton.disabled = false;
  }
  announce("A instalação do editor está disponível.");
});

installButton?.addEventListener("click", async () => {
  if (!(installButton instanceof HTMLButtonElement)) return;
  if (!deferredPrompt) {
    const userAgent = navigator.userAgent || "";
    const isAppleTouchDevice =
      /iPad|iPhone|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    announce(
      isAppleTouchDevice
        ? "No Safari, toque Compartilhar e escolha Adicionar à Tela de Início."
        : "Abra o menu do navegador e procure Instalar app ou Adicionar à tela inicial, se disponível."
    );
    return;
  }
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  installButton.disabled = true;

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      installButton.hidden = true;
      announce("Aplicativo instalado.");
    } else {
      announce("A instalação não foi concluída.");
    }
  } catch {
    announce("Não foi possível abrir a instalação neste navegador.");
  } finally {
    if (!installButton.hidden) installButton.disabled = false;
  }
});

window.addEventListener("appinstalled", () => {
  if (installButton instanceof HTMLButtonElement) installButton.hidden = true;
  announce("Aplicativo instalado.");
});

window.addEventListener("offline", () => {
  announce("Você está offline. O editor e o rascunho local continuam disponíveis depois do primeiro carregamento.");
});

window.addEventListener("online", () => {
  announce("Conexão restabelecida.");
});
