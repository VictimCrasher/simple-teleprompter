import ConfigView from './views/ConfigView'
import TeleprompterView from './views/TeleprompterView'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isTeleprompter = params.get('window') === 'teleprompter'

  return isTeleprompter ? <TeleprompterView /> : <ConfigView />
}

export default App
