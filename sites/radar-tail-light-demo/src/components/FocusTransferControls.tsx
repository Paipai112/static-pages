import { useRef } from "react";

export type FocusTransferMessage =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

interface FocusTransferControlsProps {
  focusedCount: number;
  message: FocusTransferMessage;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}

export function FocusTransferControls({
  focusedCount,
  message,
  onExport,
  onImport,
}: FocusTransferControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      await onImport(file);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="focus-transfer">
      <button
        className="filters__reset filters__reset--secondary"
        onClick={onExport}
        type="button"
      >
        导出关注列表{focusedCount > 0 ? `（${focusedCount}）` : ""}
      </button>
      <label className="filters__reset filters__reset--secondary focus-transfer__import">
        导入并替换
        <input
          accept="application/json,.json"
          aria-label="导入关注列表"
          onChange={(event) => void handleImport(event.currentTarget.files?.[0])}
          ref={inputRef}
          type="file"
        />
      </label>
      {message ? (
        <p
          className={`focus-transfer__message focus-transfer__message--${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
