import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';

export const highlightCode = () => {
  Prism.highlightAll();
}; 