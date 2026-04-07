import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link
        to="/"
        className="mb-8 inline-block text-sm font-medium text-[#22c55e] hover:text-[#86efac] transition"
      >
        ← Volver al inicio
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight theme-text-primary sm:text-3xl">
        Términos del servicio
      </h1>
      <p className="mt-2 text-sm theme-text-muted">
        Última actualización: abril de 2026 · Pineapple Group LLC · Krone Agent AI
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed theme-text-secondary">
        <p>
          Al acceder o usar <strong className="theme-text-primary">Krone Agent AI</strong>, operado por{' '}
          <strong className="theme-text-primary">Pineapple Group LLC</strong> (&quot;Pineapple&quot;,
          &quot;nosotros&quot;), usted acepta estos Términos. Si no está de acuerdo, no utilice el servicio.
        </p>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">1. Descripción del servicio</h2>
          <p className="mt-2">
            Krone Agent AI es una plataforma de <strong className="theme-text-primary">tecnología</strong> que
            permite configurar y ejecutar <strong className="theme-text-primary">agentes de voz</strong>,{' '}
            <strong className="theme-text-primary">campañas de llamadas</strong> y, cuando esté habilitado,{' '}
            <strong className="theme-text-primary">mensajes SMS</strong>, así como integraciones con
            proveedores de terceros (por ejemplo, telecomunicaciones, IA de voz y pagos). El servicio puede
            cambiar o actualizarse; cuando sea material, lo comunicaremos por medios razonables.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">
            2. Responsabilidades del usuario sobre sus contactos
          </h2>
          <p className="mt-2">
            Usted es el <strong className="theme-text-primary">único responsable</strong> de las listas de
            contactos que importa, sincroniza o utiliza. Debe contar con consentimiento y bases legales válidas
            (por ejemplo TCPA, GDPR, Habeas Data y normas locales de telecomunicaciones) antes de contactar a
            terceros. Pineapple Group LLC / Krone Agent AI actúa como{' '}
            <strong className="theme-text-primary">proveedor de tecnología</strong>; no valida de forma
            independiente el cumplimiento legal de cada campaña.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">3. Política de uso aceptable</h2>
          <p className="mt-2">
            Debe usar el servicio de manera lícita, respetando la privacidad de las personas y las normas de
            operadores y redes. Debe mantener la confidencialidad de sus credenciales y notificar de inmediato
            cualquier uso no autorizado.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">4. Prohibiciones</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="theme-text-primary">Spam</strong> o envío masivo no solicitado de llamadas o
              SMS.
            </li>
            <li>
              Contactar a personas <strong className="theme-text-primary">sin consentimiento</strong> cuando la
              ley lo exija, o ignorar solicitudes válidas de exclusión (por ejemplo, STOP en SMS cuando
              aplique).
            </li>
            <li>
              Suplantación, engaño, acoso, contenido ilegal o uso del servicio para violar derechos de
              terceros.
            </li>
            <li>
              Intentar vulnerar la seguridad del servicio, realizar ingeniería inversa no permitida o usar el
              servicio para actividades prohibidas por ley.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">
            5. Limitación de responsabilidad de Pineapple Group LLC
          </h2>
          <p className="mt-2">
            En la máxima medida permitida por la ley aplicable, el servicio se ofrece &quot;tal cual&quot; y
            &quot;según disponibilidad&quot;. <strong className="theme-text-primary">Pineapple Group LLC</strong>{' '}
            no será responsable por daños indirectos, incidentales, especiales, consecuentes o lucro cesante
            derivados del uso o la imposibilidad de uso del servicio, ni por reclamaciones de terceros
            relacionadas con sus campañas, contenido o datos de contacto.
          </p>
          <p className="mt-2">
            Nuestra responsabilidad total agregada por cualquier reclamo relacionado con el servicio, en la
            medida en que no pueda excluirse por ley, se limitará al mayor entre (a) lo que usted haya pagado
            por el servicio en los tres (3) meses previos al evento que dio origen al reclamo, o (b) cien
            dólares estadounidenses (USD 100).
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">6. Terminación del servicio</h2>
          <p className="mt-2">
            Podemos suspender o terminar su acceso si incumple estos Términos, si existe riesgo legal o de
            seguridad, o según lo exija la ley. Usted puede dejar de usar el servicio en cualquier momento.
            Tras la terminación, pueden conservarse ciertos datos el tiempo necesario para cumplir obligaciones
            legales o resolver disputas, conforme a nuestra Política de privacidad.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">7. Ley aplicable</h2>
          <p className="mt-2">
            Estos Términos se regirán por las leyes del{' '}
            <strong className="theme-text-primary">Estado de Delaware, Estados Unidos</strong>, sin tener en
            cuenta sus normas sobre conflicto de leyes. Usted acepta la jurisdicción de los tribunales
            competentes en dicho Estado, salvo que la ley de su país como consumidor disponga lo contrario de
            forma imperativa.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">
            8. Mensajes SMS y tarifas (destinatarios finales)
          </h2>
          <p className="mt-2">
            La frecuencia de los mensajes depende de la campaña. Pueden aplicarse{' '}
            <strong className="theme-text-primary">tarifas de mensajes y datos</strong> según su operador. Para
            ayuda, responda <strong className="theme-text-primary">HELP</strong> al número indicado cuando el
            operador lo permita, o escriba a{' '}
            <a href="mailto:hola@thekroneai.com" className="font-medium text-[#22c55e] hover:underline">
              hola@thekroneai.com
            </a>
            . Para dejar de recibir SMS, use <strong className="theme-text-primary">STOP</strong> cuando
            corresponda según el mensaje y la normativa aplicable.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">9. Contacto</h2>
          <p className="mt-2">
            <a href="mailto:hola@thekroneai.com" className="font-medium text-[#22c55e] hover:underline">
              hola@thekroneai.com
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
