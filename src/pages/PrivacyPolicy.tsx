import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link
        to="/"
        className="mb-8 inline-block text-sm font-medium text-[#22c55e] hover:text-[#86efac] transition"
      >
        ← Volver al inicio
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight theme-text-primary sm:text-3xl">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm theme-text-muted">
        Última actualización: abril de 2026
      </p>
      <p className="mt-1 text-sm theme-text-muted">
        <strong className="theme-text-primary">Pineapple Group LLC</strong> ·{' '}
        <strong className="theme-text-primary">Krone Agent AI</strong>
        <br />
        Estados Unidos
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed theme-text-secondary">
        <p>
          Esta política describe cómo <strong className="theme-text-primary">Pineapple Group LLC</strong>{' '}
          (en adelante, &quot;nosotros&quot;) y la plataforma{' '}
          <strong className="theme-text-primary">Krone Agent AI</strong> recopilan, usan, conservan y
          protegen la información en relación con el servicio de agentes de voz, campañas y mensajería.
        </p>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">
            1. Información que recopilamos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="theme-text-primary">Datos de cuenta:</strong> nombre, correo electrónico y
              teléfono que nos proporcione al registrarse o actualizar su perfil.
            </li>
            <li>
              <strong className="theme-text-primary">Datos de uso de la plataforma:</strong> registros de
              actividad necesarios para operar el servicio (por ejemplo, inicios de sesión, configuración de
              campañas, integraciones y métricas agregadas de uso).
            </li>
            <li>
              <strong className="theme-text-primary">Información de contactos importados:</strong> datos que
              usted carga o sincroniza (como nombres y números de teléfono) para ejecutar llamadas o SMS. Usted
              declara que cuenta con bases legales y consentimientos conforme a la normativa aplicable.
            </li>
            <li>
              <strong className="theme-text-primary">Datos técnicos:</strong> dirección IP, tipo de
              dispositivo, navegador y registros de diagnóstico cuando resulte necesario para seguridad y
              cumplimiento.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">2. Cómo usamos la información</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Para operar el servicio de <strong className="theme-text-primary">agentes de voz</strong> y
              campañas de contacto según su configuración.
            </li>
            <li>
              Para procesar <strong className="theme-text-primary">pagos</strong> a través de{' '}
              <strong className="theme-text-primary">Stripe</strong>, incluida facturación y comprobantes
              asociados a su cuenta.
            </li>
            <li>
              Para enviar <strong className="theme-text-primary">SMS</strong> vía{' '}
              <strong className="theme-text-primary">Twilio</strong> cuando usted active dichas funciones,
              siempre sujeto a que usted cumpla con el consentimiento y las leyes aplicables.
            </li>
            <li>
              Para soporte, seguridad, prevención de fraude y mejora del producto, incluyendo analítica
              agregada cuando corresponda.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">3. Compartir información</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="theme-text-primary">No vendemos</strong> sus datos personales a terceros.
            </li>
            <li>
              Podemos compartir información con <strong className="theme-text-primary">proveedores</strong>{' '}
              que nos ayudan a prestar el servicio, entre otros:{' '}
              <strong className="theme-text-primary">Twilio</strong>,{' '}
              <strong className="theme-text-primary">Retell AI</strong>,{' '}
              <strong className="theme-text-primary">Supabase</strong> y{' '}
              <strong className="theme-text-primary">Stripe</strong>. Estos proveedores procesan datos solo
              según nuestras instrucciones y en la medida necesaria para la prestación del servicio.
            </li>
            <li>
              Podemos divulgar información si la ley lo exige, por orden judicial o para proteger derechos,
              seguridad o integridad del servicio.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">4. Derechos del usuario</h2>
          <p className="mt-2">
            Según su jurisdicción, puede tener derecho a <strong className="theme-text-primary">acceso</strong>
            , <strong className="theme-text-primary">rectificación</strong>,{' '}
            <strong className="theme-text-primary">eliminación</strong> u oposición al tratamiento de sus datos.
            También puede solicitar la limitación u oponerse a ciertos usos.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="theme-text-primary">Opt-out de comunicaciones:</strong> puede dejar de recibir
              correos promocionales siguiendo el enlace de baja o contactándonos.
            </li>
            <li>
              <strong className="theme-text-primary">Habeas Data (Colombia / LATAM):</strong> los titulares en
              Colombia y otras jurisdicciones latinoamericanas pueden ejercer derechos de conocimiento,
              actualización, rectificación y supresión conforme a la ley local.
            </li>
            <li>
              <strong className="theme-text-primary">TCPA (EE. UU.):</strong> el uso de llamadas y SMS con
              fines comerciales debe cumplir el consentimiento previo y las reglas de exclusión aplicables.
              Los destinatarios de SMS pueden usar mecanismos como <strong className="theme-text-primary">STOP</strong>{' '}
              cuando corresponda.
            </li>
            <li>
              <strong className="theme-text-primary">GDPR (Europa):</strong> si se aplica, puede ejercer
              derechos ante el responsable del tratamiento y, en su caso, presentar reclamación ante una
              autoridad de protección de datos.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">5. Retención de datos</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="theme-text-primary">Datos de cuenta:</strong> mientras mantenga una cuenta
              activa o según sea necesario para cumplir obligaciones legales.
            </li>
            <li>
              <strong className="theme-text-primary">Logs de llamadas:</strong> hasta{' '}
              <strong className="theme-text-primary">12 meses</strong>, salvo que la ley exija otro plazo o
              usted solicite eliminación cuando sea procedente.
            </li>
            <li>
              <strong className="theme-text-primary">Grabaciones:</strong> hasta{' '}
              <strong className="theme-text-primary">30 días</strong>, salvo configuración distinta acordada o
              requerimiento legal.
            </li>
          </ul>
          <p className="mt-3 text-xs theme-text-muted">
            Los plazos pueden variar según el producto contratado y obligaciones legales; en caso de conflicto,
            prevalecerá la normativa aplicable.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold theme-text-primary">6. Contacto</h2>
          <p className="mt-2">
            Para consultas sobre privacidad o ejercicio de derechos:{' '}
            <a
              href="mailto:hola@thekroneai.com"
              className="font-medium text-[#22c55e] hover:underline"
            >
              hola@thekroneai.com
            </a>
          </p>
          <p className="mt-2">
            Sitio:{' '}
            <a
              href="https://voice.thekroneai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#22c55e] hover:underline"
            >
              voice.thekroneai.com
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
