import { exec } from "child_process";
import { platform } from "os";

// Repassamos as flags --pretty (para o tsc) e --color (para o eslint)
const command = "npm run tsc && npm run lint";

// Forçamos o ambiente a aceitar cores, enganando as ferramentas para acharem que estão num terminal real
const env = { ...process.env, FORCE_COLOR: "1" };

console.log("⏳ Rodando verificações detalhadas (tsc e eslint)...");

exec(command, { env }, (error, stdout, stderr) => {
  const rawOutput = stdout + (stderr ? "\n" + stderr : "");

  // 1. Mostra o log no terminal EXATAMENTE como original, preservando cores e recuos de código
  console.log(rawOutput);

  if (error) {
    // 2. Remove os códigos de cor ANSI para não sujar a sua área de transferência
    // Isso garante que você cole apenas o texto puro e legível no chat ou no GitHub
    const cleanOutput = rawOutput.replace(/\x1B\[\d+(;\d+)*[mK]/g, "");

    // 3. Comando de clipboard robusto.
    // O fallback para wl-copy garante que a cópia funcione perfeitamente caso você
    // esteja rodando uma interface moderna (como KDE Plasma sob Wayland).
    const copyCmd =
      platform() === "darwin"
        ? "pbcopy"
        : platform() === "win32"
          ? "clip"
          : "wl-copy || xclip -selection clipboard";

    const clipProcess = exec(copyCmd);
    clipProcess.stdin.write(cleanOutput);
    clipProcess.stdin.end();

    console.log(
      "\n❌ Erros encontrados! O output detalhado foi copiado limpo para a área de transferência.",
    );
    process.exit(1);
  } else {
    console.log("\n✅ Tudo certo! Nenhum erro encontrado.");
  }
});
