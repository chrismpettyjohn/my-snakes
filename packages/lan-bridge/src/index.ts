export const agentSource = () => Bun.file(`${import.meta.dir}/agent.ts`).text();
