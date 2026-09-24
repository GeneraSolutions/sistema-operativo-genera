"use client";

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        checked
          ? "border-[#1f6b45]/40 bg-[#1f6b45]/8"
          : "border-[#d8d2c4] bg-[#fbfaf6] opacity-80"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-[#1f6b45]" : "bg-[#c4bbb0]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#12241c]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[#4d5c55]">
            {description}
          </span>
        ) : null}
        <span
          className={`mt-1 inline-block text-[10px] font-bold tracking-wider uppercase ${
            checked ? "text-[#1f6b45]" : "text-[#8a7f70]"
          }`}
        >
          {checked ? "Activable" : "Desactivable"}
        </span>
      </span>
    </button>
  );
}
