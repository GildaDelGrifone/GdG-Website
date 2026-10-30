import { imageSize } from './images';

type Node = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };

// Plugin rehype per le immagini nel testo degli articoli: aggiunge width/height (evita che la pagina "salti" mentre
// le immagini si caricano) e il caricamento differito. Le dimensioni si leggono dal file locale o dall'indirizzo remoto.
export default function rehypeImageSize() {
  return async (tree: Node) => {
    const images: Node[] = [];
    const walk = (node: Node) => {
      if (node.type === 'element' && node.tagName === 'img') images.push(node);
      node.children?.forEach(walk);
    };
    walk(tree);

    await Promise.all(
      images.map(async (img) => {
        const props = (img.properties ??= {});
        const src = typeof props.src === 'string' ? props.src : undefined;
        const { width, height } = await imageSize(src);
        if (width && height) Object.assign(props, { width, height });
        props.loading ??= 'lazy';
        props.decoding ??= 'async';
      }),
    );
  };
}
