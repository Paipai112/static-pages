import { createRoot } from 'react-dom/client';
import '../globals.css';
import './demo.css';
import { DemoApp } from './DemoApp';

document.body.classList.add('dmo-body');
const root = document.getElementById('root');
if (!root) throw new Error('缺少 Demo 挂载节点');
createRoot(root).render(<DemoApp />);
