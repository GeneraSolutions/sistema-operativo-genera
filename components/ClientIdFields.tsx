"use client";

import {
  CLIENT_ID_TYPE_OPTIONS,
  isNitDocument,
  type ClientIdType,
} from "@/lib/client-party";

const inputClass =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export function ClientIdFields({
  idType,
  number,
  dv,
  onType,
  onNumber,
  onDv,
}: {
  idType: ClientIdType;
  number: string;
  dv: string;
  onType: (next: ClientIdType) => void;
  onNumber: (next: string) => void;
  onDv: (next: string) => void;
}) {
  const nit = isNitDocument(idType);
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tipo de documento</span>
        <select
          className={inputClass}
          value={idType}
          onChange={(e) => onType(e.target.value as ClientIdType)}
        >
          {CLIENT_ID_TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          {nit ? "NIT / DV" : "Número de cédula"}
        </span>
        <div className="flex gap-2">
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder={nit ? "NIT" : "Cédula"}
            value={number}
            onChange={(e) => onNumber(e.target.value)}
          />
          {nit ? (
            <input
              className={`${inputClass} w-16`}
              placeholder="DV"
              maxLength={1}
              value={dv}
              onChange={(e) => onDv(e.target.value)}
            />
          ) : null}
        </div>
      </label>
    </div>
  );
}
