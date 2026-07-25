import { GameScreen } from './components/game/GameScreen'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">Coach Sim</h1>
      </header>
      <GameScreen />
    </div>
  )
}

export default App
