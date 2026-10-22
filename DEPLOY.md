# Guía de instalación — UNA MONEDITA

Despliega tu propia copia privada de la app, conectada a tu propia cuenta de Notion.
Tus datos viven solo en tu Notion y tu Vercel. Nadie más los ve.

---

## Opción rápida

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffdrecabarren%2Funa-monedita&project-name=una-monedita&repository-name=una-monedita)

El botón copia el repositorio a tu GitHub y lo despliega en tu Vercel sin configurar
nada. Después ve a la sección 5 (Conecta Notion); si aún no tienes tu plantilla ni tu
integración de Notion, haz antes las secciones 1 a 3.

---

## Resumen

1. Duplica la plantilla de Notion a tu cuenta
2. Crea una integración de Notion y compártela con tu página
3. Despliega la app en tu propio Vercel (sin variables obligatorias; se recomienda `AUTH_COOKIE_SECRET`)
4. Conecta Notion dentro de la app (`/setup`)
5. Usa la app

La app **no tiene contraseña**: conectar tu Notion (token + URL de tu página) es el
ingreso. Cada persona usa su propia cuenta de Notion.

---

## 1. Duplica la plantilla de Notion

1. Abre la plantilla: <https://app.notion.com/p/UNA-MONEDITA-copy-3795c48e39b6803da9abf7ab40919b39?source=copy_link>
2. Arriba a la derecha pulsa **Duplicar** (Duplicate).
3. Se copiará "UNA MONEDITA" a tu cuenta, con 6 bases de datos dentro:
   Categories, Accounts, FX Rates, Subscriptions, Budgets, Transactions.

## 2. Crea una integración de Notion

1. Ve a <https://www.notion.so/my-integrations> → **New integration**.
2. Nombre: `UNA MONEDITA` (o el que quieras). Créala.
3. Copia el **Internal Integration Token** (empieza con `ntn_` o `secret_`). Guárdalo.

## 3. Comparte tu página con la integración

1. Abre tu página duplicada en Notion.
2. Arriba a la derecha: menú **⋯** → **Conexiones** (Connections).
3. Busca tu integración y agrégala. Esto le da acceso a las 6 bases de datos.

## 4. Despliega en Vercel

No hay ninguna variable de entorno obligatoria. Elige una de estas dos formas:

- **Opción A, botón:** pulsa el botón **Deploy with Vercel** de arriba. Copia el
  repositorio a tu GitHub y lo despliega en tu Vercel.
- **Opción B, fork:** haz un fork del repositorio en GitHub, entra a
  <https://vercel.com> → **New Project** → importa tu fork y pulsa **Deploy**.

Espera a que termine el deploy.

**Variable recomendada**

| Variable | Valor |
|----------|-------|
| `AUTH_COOKIE_SECRET` | Texto aleatorio de 32+ caracteres (con `openssl rand -base64 32`) |

Con ese secreto se cifra la cookie que guarda tu conexión a Notion. Sin ella la app
funciona igual (genera una clave propia al compilar), pero cada nuevo deploy puede pedir
que reconectes cada dispositivo. Para evitarlo, defínela en **Settings → Environment
Variables**, con el mismo valor en Production y Preview, y vuelve a desplegar. Si la
cambias después, todos los dispositivos pierden la conexión y hay que reconectar.

**No definas** `NOTION_*` ni `DEV_AUTH_BYPASS` en Vercel: son solo para desarrollo
local, y en un deploy compartido harían que otra persona viera tu Notion.

## 5. Conecta Notion

1. Abre tu app desplegada. Sin conexión te lleva a **Conecta tu Notion** (`/setup`).
2. Pega:
   - La **URL de tu página** duplicada (en Notion: Compartir → Copiar enlace).
   - El **token** de integración (paso 2).
3. Deja marcado **Recordar en este dispositivo** (en una compu compartida, desmárcalo).
4. Pulsa **Conectar**. La app encuentra tus 6 bases de datos automáticamente.

Notas sobre la conexión:

- Se guarda en una cookie cifrada de ese dispositivo (400 días con "Recordar"; si no,
  hasta cerrar el navegador). El servidor no guarda nada.
- **Cada dispositivo se conecta una vez.** En el iPhone, la app instalada en la
  pantalla de inicio tiene cookies separadas de Safari: conéctala dentro de la app
  instalada.
- El llavero (iCloud, Chrome) puede guardar la URL y el token para completarlos en
  otro dispositivo.
- **Ajustes → Notion → Desconectar Notion** borra la conexión de ese dispositivo.
  Tus datos quedan en Notion.
- Si pierdes un dispositivo: en <https://www.notion.so/my-integrations> regenera el
  token de la integración y vuelve a conectar.

## 6. Usa la app

Empieza a registrar gastos e ingresos. La moneda por defecto es **Euro**; puedes
cambiarla en **Ajustes → Moneda**. Para que el **Disponible hoy** sea tu plata real,
ve a **Ajustes → Saldo → ¿Cuánta plata tenés hoy?** y escribe lo que tienes (efectivo
más banco).

---

## Compartir tu deploy

Cada persona conecta **su propia cuenta de Notion**: nadie ve los datos de otro.
Aun así, el servidor usa el token de quien se conecta para leer su Notion. Lo más
seguro es que cada persona haga su propio deploy desde el repositorio; si varias
personas comparten una instalación, deben confiar en quien la administra.

## Notas

- Si la app te lleva a `/setup` con "Tu conexión venció" o "Notion rechazó el token":
  reconecta (¿regeneraste el token o quitaste la integración de la página?).
- Si `/setup` dice que no encuentra alguna base de datos: revisa que duplicaste la
  plantilla correcta y que compartiste la página con tu integración (paso 3).
- Si ves "Falta AUTH_COOKIE_SECRET" o "tiene el valor de ejemplo": definiste la variable
  con menos de 32 caracteres o con el valor de `.env.example`. Corrígela en Vercel
  (32+ caracteres, distinta del ejemplo) o bórrala, y vuelve a desplegar.
- Si la app te pide conectar Notion otra vez después de un deploy y no definiste
  `AUTH_COOKIE_SECRET`: la clave automática cambió. Define la variable para evitarlo.
- Para desarrollo local (`pnpm dev`) ver el README.
