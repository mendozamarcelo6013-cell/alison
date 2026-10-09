import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../components/admin/Modal';

interface Props {
  mensaje: string;
  onSesionIniciada: (email: string, password: string) => Promise<void>;
}

/**
 * Muro de acceso: sólo responde con datos si el backend emite un token de rol
 * admin. No se cierra con Escape ni con clic fuera (igual que el original).
 */
export function ModalLogin({ mensaje, onSesionIniciada }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(mensaje);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setError(mensaje), [mensaje]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await onSesionIniciada(email.trim(), password);
    } catch (errorLogin) {
      setError(errorLogin instanceof Error ? errorLogin.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={() => undefined} id="login-backdrop" className="modal modal-sm" labelledBy="login-title">
      <h2 id="login-title">Acceso al panel</h2>
      <p className="muted">
        Solo usuarios con rol <strong>admin</strong>. Crea el primero con{' '}
        <code>npm run db:seed:admin</code>.
      </p>
      <form id="login-form" onSubmit={(evento) => void enviar(evento)}>
        <div className="form-grid single">
          <label>
            Email
            <input
              id="l-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              id="l-pass"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
            />
          </label>
        </div>
        <p id="login-error" className="form-error" hidden={!error}>{error}</p>
        <div className="modal-foot">
          <button type="submit" id="login-submit" className="btn btn-primary" disabled={enviando}>
            Iniciar sesión
          </button>
        </div>
      </form>
    </Modal>
  );
}
