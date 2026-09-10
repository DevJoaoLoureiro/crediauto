'use client';

import { useState } from 'react';
import { Document, pdfjs } from 'react-pdf';

import PdfPage from '@/components/pdf-editor/pdf-page';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type ConsentValue = 'yes' | 'no' | '';

export type RgpdFormData = {
  fullName: string;
  identificationNumber: string;
  nif: string;

  dataSharing: ConsentValue;
  dataReceiving: ConsentValue;
  marketing: ConsentValue;

  signatureImage: string;
  signatureDate: string;
};

type PdfEditorProps = {
  pdfUrl: string;

  initialData?: Partial<RgpdFormData>;

  onSubmit?: (
    data: RgpdFormData,
  ) => Promise<void> | void;
};

function getToday() {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export default function PdfEditor({
  pdfUrl,
  initialData,
  onSubmit,
}: PdfEditorProps) {
  const [numPages, setNumPages] =
    useState(0);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [formData, setFormData] =
    useState<RgpdFormData>({
      fullName:
        initialData?.fullName ?? '',

      identificationNumber:
        initialData?.identificationNumber ?? '',

      nif:
        initialData?.nif ?? '',

      dataSharing:
        initialData?.dataSharing ?? '',

      dataReceiving:
        initialData?.dataReceiving ?? '',

      marketing:
        initialData?.marketing ?? '',

      signatureImage:
        initialData?.signatureImage ?? '',

      signatureDate:
        initialData?.signatureDate ??
        getToday(),
    });

  function updateField<K extends keyof RgpdFormData>(
    field: K,
    value: RgpdFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

function validate() {
  if (!formData.fullName.trim()) {
    return 'Preencha o nome completo.';
  }

  if (!formData.identificationNumber.trim()) {
    return 'Preencha o número de identificação.';
  }

  if (!formData.nif.trim()) {
    return 'Preencha o NIF.';
  }

  if (!/^\d{9}$/.test(formData.nif)) {
    return 'O NIF deve ter 9 dígitos.';
  }

  if (!formData.dataSharing) {
    return 'Selecione uma opção em Envio de Dados.';
  }

  if (!formData.dataReceiving) {
    return 'Selecione uma opção em Receção de Dados.';
  }

  if (!formData.marketing) {
    return 'Selecione uma opção em Marketing.';
  }

  if (!formData.signatureImage) {
    return 'É necessário assinar o documento.';
  }

  return null;
}
  async function handleSubmit() {
    setError(null);

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!onSubmit) {
      console.log(
        'Dados RGPD:',
        formData,
      );

      return;
    }

    try {
      setSubmitting(true);

      await onSubmit(formData);
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível submeter o documento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
        }}
        loading={
          <div className="p-8 text-center">
            A carregar documento...
          </div>
        }
        error={
          <div className="rounded-lg bg-red-50 p-8 text-red-700">
            Não foi possível carregar o PDF.
          </div>
        }
      >
        <div className="flex flex-col items-center gap-6">
          {Array.from(
            { length: numPages },
            (_, index) => (
              <PdfPage
                key={index + 1}
                pageNumber={index + 1}
                formData={formData}
                onFieldChange={updateField}
              />
            ),
          )}
        </div>
      </Document>

      <div className="mx-auto mt-8 max-w-[800px]">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="
            w-full
            rounded-xl
            bg-[#006571]
            px-5
            py-3.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#00535d]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {submitting
            ? 'A submeter documento...'
            : 'Submeter documento RGPD'}
        </button>

        <p className="mt-3 text-center text-xs text-gray-400">
          Confirme os dados e a assinatura antes de submeter.
        </p>
      </div>
    </div>
  );
}