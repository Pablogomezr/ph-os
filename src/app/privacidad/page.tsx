export const metadata = { title: "Política de Privacidad — PH OS" };

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: junio de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Quiénes somos</h2>
          <p className="text-muted-foreground leading-relaxed">
            PH OS (Propiedad Horizontal OS) es una plataforma de administración para
            copropiedades en Colombia. Cada edificio que usa la plataforma administra
            su propia información de forma aislada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Información que recopilamos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Recopilamos los datos que la administración del edificio registra sobre
            propietarios y arrendatarios (nombre, correo, teléfono, unidad) y los
            necesarios para la gestión administrativa, financiera y de mantenimiento
            de la copropiedad (cargos, pagos, comprobantes, solicitudes PQRS,
            comunicados).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Mensajería por WhatsApp</h2>
          <p className="text-muted-foreground leading-relaxed">
            Si tu copropiedad habilita el canal de WhatsApp, los mensajes y
            comprobantes de pago que envíes al número oficial del edificio se procesan
            para registrar tu pago automáticamente. Las imágenes de comprobantes se
            almacenan de forma segura como respaldo del pago. No usamos esta
            información para fines distintos a la administración de tu copropiedad,
            y no se comparte con terceros ajenos a la operación del edificio.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Cómo protegemos tu información</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cada edificio tiene su información completamente aislada de los demás. El
            acceso a los datos está protegido por autenticación y restringido según el
            rol del usuario (propietario, arrendatario, administrador).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Tus derechos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Puedes solicitar la corrección o eliminación de tu información contactando
            directamente a la administración de tu copropiedad, quien es responsable
            del tratamiento de tus datos dentro de la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para preguntas sobre esta política, contacta a la administración de tu
            edificio a través de los canales oficiales que ya conoces (WhatsApp,
            correo o el portal de PH OS).
          </p>
        </section>
      </div>
    </div>
  );
}
