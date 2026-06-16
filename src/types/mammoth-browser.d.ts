declare module "mammoth/mammoth.browser" {
  type ImageElement = {
    contentType: string;
    read: (encoding?: string) => Promise<string>;
  };
  type Options = {
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: (image: ImageElement) => Promise<Record<string, string>>;
    ignoreEmptyParagraphs?: boolean;
  };
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: Options,
  ): Promise<{ value: string; messages: unknown[] }>;
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
  export const images: {
    imgElement: (
      func: (image: ImageElement) => Promise<Record<string, string>>,
    ) => (image: ImageElement) => Promise<Record<string, string>>;
    dataUri: (image: ImageElement) => Promise<Record<string, string>>;
  };
}
