import type { LanguageOption, CanvasSize } from '@generate/types/engine';

export interface GameConfig {
  name: string;
  languages: LanguageOption[];
  /** Base logical canvas size for aspect ratio and scaling */
  canvas_size: CanvasSize;
}
