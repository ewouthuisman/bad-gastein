import { SoipenMeter } from '../features/soipen/SoipenMeter';
import { DrinkButtons } from '../features/soipen/DrinkButtons';
import { ChatPanel } from '../features/soipie/ChatPanel';

export function AiTab() {
  return (
    <section className="page">
      <h1>AI</h1>
      <SoipenMeter />
      <ChatPanel />
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Drankje loggen</h2>
        <DrinkButtons />
      </div>
    </section>
  );
}
