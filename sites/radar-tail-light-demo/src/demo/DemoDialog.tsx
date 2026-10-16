import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function DemoDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} className="dmo-dialog" aria-labelledby={id}
    onCancel={event => { event.preventDefault(); close.current(); }}
    onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close.current(); } }}>
    <div className="dmo-dialog__heading"><h2 id={id}>{title}</h2><button className="dmo-icon-button" aria-label="关闭弹窗" onClick={onClose}>×</button></div>
    <div className="dmo-dialog__body">{children}</div>
  </dialog>, document.body);
}
