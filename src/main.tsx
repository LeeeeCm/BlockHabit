import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/zcool-qingke-huangyou/chinese-simplified.css'
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import './theme.css'
import './components/ui.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
