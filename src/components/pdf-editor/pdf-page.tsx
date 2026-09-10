'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Page } from 'react-pdf';

import SignatureCanvas from 'react-signature-canvas';

import type {
  ConsentValue,
  RgpdFormData,
} from '@/components/pdf-editor/pdf-editor';

type PdfPageProps = {
  pageNumber: number;

  formData: RgpdFormData;

  onFieldChange: <
    K extends keyof RgpdFormData,
  >(
    field: K,
    value: RgpdFormData[K],
  ) => void;
};

const PDF_WIDTH = 595.32;

export default function PdfPage({
  pageNumber,
  formData,
  onFieldChange,
}: PdfPageProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [width, setWidth] =
    useState(800);

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) return;

    const updateWidth = () => {
      setWidth(
        Math.min(
          element.clientWidth,
          800,
        ),
      );
    };

    updateWidth();

    const observer =
      new ResizeObserver(
        updateWidth,
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[800px]"
    >
      <div
        className="relative mx-auto"
        style={{ width }}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />

        {pageNumber === 4 && (
          <PageFourFields
            width={width}
            formData={formData}
            onFieldChange={
              onFieldChange
            }
          />
        )}

        {pageNumber === 5 && (
          <PageFiveFields
            width={width}
            formData={formData}
            onFieldChange={
              onFieldChange
            }
          />
        )}

        {pageNumber === 6 && (
          <PageSixFields
            width={width}
            formData={formData}
            onFieldChange={
              onFieldChange
            }
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   PÁGINA 4
   Nome + Identificação + NIF
========================================================= */

type SharedFieldsProps = {
  width: number;

  formData: RgpdFormData;

  onFieldChange: <
    K extends keyof RgpdFormData,
  >(
    field: K,
    value: RgpdFormData[K],
  ) => void;
};

function PageFourFields({
  width,
  formData,
  onFieldChange,
}: SharedFieldsProps) {
  const scale =
    width / PDF_WIDTH;

  const fields = [
    {
      name: 'fullName' as const,
      label: 'Nome completo',
      x: 202.61,
      lineY: 150.5,
      maxX: 540.94,
      inputMode:
        'text' as const,
    },
    {
      name:
        'identificationNumber' as const,
      label:
        'Número de identificação',
      x: 202.61,
      lineY: 173.66,
      maxX: 540.94,
      inputMode:
        'text' as const,
    },
    {
      name: 'nif' as const,
      label: 'NIF',
      x: 201.89,
      lineY: 196.82,
      maxX: 540.94,
      inputMode:
        'numeric' as const,
      maxLength: 9,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {fields.map((field) => {
        const fontSize =
          10 * scale;

        const fieldHeight =
          18 * scale;

        return (
          <input
            key={field.name}
            type="text"
            name={field.name}
            aria-label={
              field.label
            }
            value={
              formData[
                field.name
              ]
            }
            inputMode={
              field.inputMode
            }
            maxLength={
              field.maxLength
            }
            autoComplete={
              field.name ===
              'fullName'
                ? 'name'
                : 'off'
            }
            onChange={(event) => {
              let value =
                event.target.value;

              if (
                field.name ===
                'nif'
              ) {
                value =
                  value.replace(
                    /\D/g,
                    '',
                  );
              }

              onFieldChange(
                field.name,
                value,
              );
            }}
            className="
              pointer-events-auto
              absolute
              z-20
              appearance-none
              border-0
              bg-transparent
              p-0
              font-sans
              font-normal
              text-black
              outline-none
              shadow-none
            "
            style={{
              left:
                field.x *
                scale,

              top:
                (field.lineY -
                  17) *
                scale,

              width:
                (field.maxX -
                  field.x) *
                scale,

              height:
                fieldHeight,

              fontSize,

              lineHeight: `${fieldHeight}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/* =========================================================
   CONSENTIMENTO
========================================================= */

type ConsentChoiceProps = {
  width: number;
  y: number;

  value: ConsentValue;

  onChange: (
    value: ConsentValue,
  ) => void;
};

function ConsentChoice({
  width,
  y,
  value,
  onChange,
}: ConsentChoiceProps) {
  const scale =
    width / PDF_WIDTH;

  const boxX = 116.5;
  const boxSize = 21;

  return (
    <>
      <button
        type="button"
        aria-label="Autorizo"
        aria-pressed={
          value === 'yes'
        }
        onClick={() =>
          onChange('yes')
        }
        className="
          pointer-events-auto
          absolute
          z-30
          flex
          items-center
          justify-center
          border-0
          bg-transparent
          p-0
          outline-none
        "
        style={{
          left:
            (boxX - 5) *
            scale,

          top:
            (y - 5) *
            scale,

          width:
            (boxSize + 10) *
            scale,

          height:
            (boxSize + 10) *
            scale,
        }}
      >
        {value === 'yes' && (
          <span
            className="font-bold text-black"
            style={{
              fontSize:
                22 * scale,
              lineHeight: 1,
            }}
          >
            ✓
          </span>
        )}
      </button>

      <button
        type="button"
        aria-label="Não autorizo"
        aria-pressed={
          value === 'no'
        }
        onClick={() =>
          onChange('no')
        }
        className="
          pointer-events-auto
          absolute
          z-30
          flex
          items-center
          justify-center
          border-0
          bg-transparent
          p-0
          outline-none
        "
        style={{
          left:
            (boxX - 5) *
            scale,

          top:
            (y + 26 - 5) *
            scale,

          width:
            (boxSize + 10) *
            scale,

          height:
            (boxSize + 10) *
            scale,
        }}
      >
        {value === 'no' && (
          <span
            className="font-bold text-black"
            style={{
              fontSize:
                22 * scale,
              lineHeight: 1,
            }}
          >
            ✓
          </span>
        )}
      </button>
    </>
  );
}

/* =========================================================
   PÁGINA 5
========================================================= */

function PageFiveFields({
  width,
  formData,
  onFieldChange,
}: SharedFieldsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <ConsentChoice
        width={width}
        value={
          formData.dataSharing
        }
        onChange={(value) =>
          onFieldChange(
            'dataSharing',
            value,
          )
        }
        y={570}
      />
    </div>
  );
}

/* =========================================================
   PÁGINA 6
========================================================= */

function PageSixFields({
  width,
  formData,
  onFieldChange,
}: SharedFieldsProps) {
  const scale =
    width / PDF_WIDTH;

  const signatureRef =
    useRef<SignatureCanvas | null>(
      null,
    );

  const [
    signatureOpen,
    setSignatureOpen,
  ] = useState(false);

  function clearSignature() {
    signatureRef.current?.clear();
  }

  function saveSignature() {
    const signature =
      signatureRef.current;

    if (
      !signature ||
      signature.isEmpty()
    ) {
      return;
    }

    const image =
      signature
        .getTrimmedCanvas()
        .toDataURL(
          'image/png',
        );

    onFieldChange(
      'signatureImage',
      image,
    );

    setSignatureOpen(false);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <ConsentChoice
        width={width}
        value={
          formData.dataReceiving
        }
        onChange={(value) =>
          onFieldChange(
            'dataReceiving',
            value,
          )
        }
        y={117}
      />

      <ConsentChoice
        width={width}
        value={
          formData.marketing
        }
        onChange={(value) =>
          onFieldChange(
            'marketing',
            value,
          )
        }
        y={298}
      />

      {!formData.signatureImage && (
        <button
          type="button"
          onClick={() =>
            setSignatureOpen(true)
          }
          className="
            pointer-events-auto
            absolute
            z-30
            border-0
            bg-transparent
            p-0
            text-left
            outline-none
          "
          style={{
            left: 118 * scale,
            top: 485 * scale,
            width: 300 * scale,
            height: 42 * scale,
          }}
        >
          <span
            className="rounded bg-white/80 px-2 py-1 text-gray-500"
            style={{
              fontSize:
                Math.max(
                  9,
                  9 * scale,
                ),
            }}
          >
            Tocar para assinar
          </span>
        </button>
      )}

      {formData.signatureImage && (
        <button
          type="button"
          onClick={() =>
            setSignatureOpen(true)
          }
          aria-label="Editar assinatura"
          className="
            pointer-events-auto
            absolute
            z-30
            border-0
            bg-transparent
            p-0
            outline-none
          "
          style={{
            left: 118 * scale,
            top: 477 * scale,
            width: 220 * scale,
            height: 50 * scale,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              formData.signatureImage
            }
            alt="Assinatura"
            className="
              block
              h-full
              w-full
              object-contain
              object-left-bottom
            "
          />
        </button>
      )}

      <div
        className="
          pointer-events-none
          absolute
          z-20
          font-sans
          text-black
        "
        style={{
          left: 118 * scale,
          top: 529 * scale,
          fontSize:
            10 * scale,
          lineHeight: `${
            16 * scale
          }px`,
        }}
      >
        {formData.signatureDate}
      </div>

      {signatureOpen && (
        <div
          className="
            pointer-events-auto
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/50
            p-4
          "
        >
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Assinatura
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Assine com o dedo ou com o rato.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-gray-300 bg-white">
              <SignatureCanvas
                ref={
                  signatureRef
                }
                penColor="black"
                canvasProps={{
                  width: 700,
                  height: 250,
                  className:
                    'block h-[220px] w-full touch-none bg-white',
                }}
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSignatureOpen(
                    false,
                  );
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  clearSignature
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={
                  saveSignature
                }
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Usar assinatura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}