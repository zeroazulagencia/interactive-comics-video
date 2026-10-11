// Estilos gráficos del video. Cada uno define el aspecto de las ilustraciones
// (artStyle) y el tipo de animación que se aplica a los clips (motionStyle).
// Las imágenes y clips de referencia están en public/styles/ y muestran la
// misma escena en cada estilo para poder compararlos.

export type VideoStyle = {
  id: string;
  name: string;
  animation: string; // nombre corto del tipo de animación
  artStyle: string;
  motionStyle: string; // en inglés, se añade al prompt de animación
  image: string;
  clip: string; // clip de 5 s con el tipo de animación
};

export const VIDEO_STYLES: VideoStyle[] = [
  {
    id: "acuarela",
    name: "Acuarela",
    animation: "Pigmento vivo",
    artStyle: "Acuarela editorial desaturada, luz cálida y tenue, grano de papel, bordes suaves.",
    motionStyle:
      "gentle slow drifting camera, watercolor pigment softly blooming and bleeding at the edges, subtle paper texture shimmer",
    image: "/styles/acuarela.jpg",
    clip: "/styles/acuarela.mp4",
  },
  {
    id: "novela-grafica",
    name: "Novela gráfica",
    animation: "Motion comic",
    artStyle: "Novela gráfica de tinta, alto contraste, sombras profundas, paleta limitada, trazos expresivos.",
    motionStyle:
      "motion comic parallax: flat layered depth, slow lateral camera pan across separated foreground and background layers, minimal motion, ink shadows shifting",
    image: "/styles/novela-grafica.jpg",
    clip: "/styles/novela-grafica.mp4",
  },
  {
    id: "cine",
    name: "Cine realista",
    animation: "Cámara de cine",
    artStyle:
      "Fotograma cinematográfico realista, lente anamórfica, iluminación dramática, profundidad de campo baja, gradación de color de película.",
    motionStyle:
      "cinematic dolly push-in, shallow depth of field with slow rack focus, volumetric light rays, natural atmospheric motion",
    image: "/styles/cine.jpg",
    clip: "/styles/cine.mp4",
  },
  {
    id: "anime",
    name: "Anime 2D",
    animation: "Animación cel",
    artStyle:
      "Anime 2D de estudio, sombreado cel, líneas limpias, cielos detallados, colores saturados y luminosos.",
    motionStyle:
      "2D cel anime animation, limited animation with held frames, clouds drifting, foliage swaying in the wind, sparkling light particles, sweeping camera pan",
    image: "/styles/anime.jpg",
    clip: "/styles/anime.mp4",
  },
  {
    id: "3d",
    name: "Animación 3D",
    animation: "3D fluido",
    artStyle: "Animación 3D estilizada tipo película, iluminación global suave, colores ricos, texturas detalladas.",
    motionStyle:
      "smooth 3D animated film camera orbit, soft bouncy secondary motion on objects, floating dust particles in warm light",
    image: "/styles/3d.jpg",
    clip: "/styles/3d.mp4",
  },
  {
    id: "papel",
    name: "Papel recortado",
    animation: "Stop motion",
    artStyle:
      "Diorama de papel recortado en capas, texturas de cartulina, sombras reales entre capas, colores planos y cálidos.",
    motionStyle:
      "stop-motion cut-out paper animation at 12 frames per second, paper layers sliding at different speeds, slight handmade jitter",
    image: "/styles/papel.jpg",
    clip: "/styles/papel.mp4",
  },
  {
    id: "plastilina",
    name: "Plastilina",
    animation: "Claymation",
    artStyle:
      "Escena de plastilina tipo claymation, modelado a mano con huellas visibles, iluminación de estudio suave, miniaturas.",
    motionStyle:
      "claymation stop-motion, slightly choppy frame-by-frame movement, small handmade imperfections, miniature set lighting",
    image: "/styles/plastilina.jpg",
    clip: "/styles/plastilina.mp4",
  },
  {
    id: "oleo",
    name: "Óleo clásico",
    animation: "Pintura viva",
    artStyle: "Pintura al óleo clásica, pinceladas visibles, claroscuro, paleta terrosa, composición de museo.",
    motionStyle:
      "living oil painting: brushstrokes subtly shifting and swirling, very slow zoom, flickering warm light",
    image: "/styles/oleo.jpg",
    clip: "/styles/oleo.mp4",
  },
  {
    id: "grabado",
    name: "Grabado antiguo",
    animation: "Película antigua",
    artStyle: "Grabado antiguo en blanco y negro, líneas de plumilla, sombreado cruzado, textura de papel envejecido.",
    motionStyle:
      "vintage silent film look: slow Ken Burns pan, heavy film grain, light flicker, dust and scratches",
    image: "/styles/grabado.jpg",
    clip: "/styles/grabado.mp4",
  },
];
