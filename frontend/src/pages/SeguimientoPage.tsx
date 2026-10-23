import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { consultarEstadoPedido } from '../api/pedidos';
import { mensajeError } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import type { DireccionRecojo } from '../types';

export function SeguimientoPage() {
  const [numero, setNumero] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{
    numero_pedido: string;
    metodo_entrega: string;
    etiqueta_estado: string;
    direccion_entrega?: DireccionRecojo;
  } | null>(null);

  const consultar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setCargando(true);
    setError('');
    setResultado(null);
    try {
      setResultado(await consultarEstadoPedido(numero.trim(), telefono.trim()));
    } catch (fallo) {
      setError(mensajeError(fallo, 'No se pudo consultar el estado del pedido.'));
    } finally {
      setCargando(false);
    }
  };

  return <>
    <SiteHeader>
      <div className="header-actions"><Link className="back-link header-action-button" to="/market">← Volver a la tienda</Link></div>
    </SiteHeader>
    <main className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Horus Market</p><h1>Consultar pedido</h1><p>Ingresa el código de pedido y el celular registrado en la compra.</p></div>
      </div>
      <section className="form-card tracking-card">
        <form className="tracking-form" onSubmit={consultar}>
          <label className="field">Código de pedido
            <input value={numero} onChange={(evento) => setNumero(evento.target.value)} placeholder="Ej. HG-20261023-ABC123" required />
          </label>
          <label className="field">Celular registrado
            <input type="tel" autoComplete="tel" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} required />
          </label>
          <button className="button-primary" type="submit" disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar estado'}</button>
        </form>
        {error ? <p className="state-message error-state" role="alert">{error}</p> : null}
        {resultado ? <div className="tracking-result" role="status">
          <p className="eyebrow">Pedido {resultado.numero_pedido}</p>
          <h2>{resultado.etiqueta_estado}</h2>
          <p>Entrega: {resultado.metodo_entrega === 'recojo_tienda' ? 'Recojo en tienda' : 'Envío a domicilio'}</p>
          {resultado.metodo_entrega === 'recojo_tienda' && resultado.direccion_entrega ? <div className="pickup-confirmation">
            <h3>{resultado.direccion_entrega.nombre_tienda}</h3>
            <p>{resultado.direccion_entrega.direccion_linea1}</p>
            {resultado.direccion_entrega.referencia ? <p><strong>Referencia:</strong> {resultado.direccion_entrega.referencia}</p> : null}
            {resultado.direccion_entrega.horario ? <p><strong>Horario:</strong> {resultado.direccion_entrega.horario}</p> : null}
            <a href={resultado.direccion_entrega.maps_url} target="_blank" rel="noreferrer">Ver ubicación en Google Maps ↗</a>
          </div> : null}
        </div> : null}
      </section>
    </main>
    <SiteFooter />
  </>;
}
