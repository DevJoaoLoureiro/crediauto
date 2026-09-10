'use client';

import dynamic from 'next/dynamic';

import type {
  RgpdFormData,
} from '@/components/pdf-editor/pdf-editor';

const PdfEditor = dynamic(
  () =>
    import(
      '@/components/pdf-editor/pdf-editor'
    ),
  {
    ssr: false,

    loading: () => (
      <div className="rounded-lg bg-white p-8 text-center">
        A carregar editor PDF...
      </div>
    ),
  },
);

type PdfEditorLoaderProps = {
  pdfUrl: string;

  initialData?: Partial<RgpdFormData>;

  onSubmit?: (
    data: RgpdFormData,
  ) => Promise<void> | void;
};

export default function PdfEditorLoader({
  pdfUrl,
  initialData,
  onSubmit,
}: PdfEditorLoaderProps) {
  return (
    <PdfEditor
      pdfUrl={pdfUrl}
      initialData={initialData}
      onSubmit={onSubmit}
    />
  );
}