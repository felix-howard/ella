/**
 * Type declarations for pdf-poppler
 * https://github.com/nickvth/pdf-poppler
 */
declare module 'pdf-poppler' {
  export interface Options {
    /** Output format: 'png', 'jpeg', 'tiff', 'ppm' */
    format?: 'png' | 'jpeg' | 'tiff' | 'ppm'
    /** Scale/DPI for rendering (default 150) */
    scale?: number
    /** Output directory path */
    out_dir?: string
    /** Output file prefix */
    out_prefix?: string
    /** First page to convert (1-indexed) */
    page?: number
  }

  export interface PdfInfo {
    /** Number of pages in PDF */
    pages?: number
    /** PDF title metadata */
    title?: string
    /** PDF author metadata */
    author?: string
    /** PDF subject metadata */
    subject?: string
    /** PDF creation date */
    creationDate?: string
    /** PDF modification date */
    modificationDate?: string
    /** PDF producer */
    producer?: string
    /** PDF creator application */
    creator?: string
  }

  /**
   * Convert PDF file to images
   * @param pdfPath - Path to PDF file
   * @param options - Conversion options
   * @returns Promise that resolves when conversion completes
   */
  export function convert(pdfPath: string, options?: Options): Promise<void>

  /**
   * Get PDF metadata information
   * @param pdfPath - Path to PDF file
   * @returns PDF information including page count
   */
  export function info(pdfPath: string): Promise<PdfInfo>
}
