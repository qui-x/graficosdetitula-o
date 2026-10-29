interface InstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
}

const installButton = document.getElementById("pwa-install-button");
const status = document.getElementById("pwa-status");
let deferredPrompt: DeferredInstallPrompt | null = null;

function announce(message: string): void {
  if (status) status.textContent = message;
}

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
  if (!(installButton instanceof HTMLButtonElement) || !deferredPrompt) return;
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
