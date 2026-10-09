import { Modal } from '../../components/admin/Modal';

interface Props {
  titulo: string;
  texto: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/** Confirmación genérica (sólo se usa para enviar a papelera). */
export function ModalConfirmacion({ titulo, texto, onCancelar, onConfirmar }: Props) {
  return (
    <Modal
      abierto
      onCerrar={onCancelar}
      id="confirm-backdrop"
      className="modal modal-sm"
      role="alertdialog"
      labelledBy="confirm-title"
      cerrarAlEscape
    >
      <h2 id="confirm-title">{titulo}</h2>
      <p id="confirm-text" className="muted">{texto}</p>
      <div className="modal-foot">
        <button id="confirm-cancel" type="button" className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button id="confirm-ok" type="button" className="btn btn-danger" onClick={onConfirmar}>Enviar a papelera</button>
      </div>
    </Modal>
  );
}
