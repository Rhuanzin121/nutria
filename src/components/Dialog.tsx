import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const descriptionId = useId();
  return (
    <D.Root open onOpenChange={(open) => !open && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay" />
        <D.Content
          className={`dialog ${wide ? "wide" : ""}`}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="dialog-heading">
            <div>
              <D.Title>{title}</D.Title>
              {description && (
                <D.Description id={descriptionId}>{description}</D.Description>
              )}
            </div>
            <D.Close className="icon-button" aria-label="Fechar">
              <X size={20} />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
