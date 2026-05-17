import ClientApp from '../components/ClientApp';

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="atmosphere-bg" />
      <div className="grid-overlay" />
      <div className="relative z-10">
        <ClientApp />
      </div>
    </main>
  );
}
