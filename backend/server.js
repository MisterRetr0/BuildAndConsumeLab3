/*
 * ============================================================
 *  API REST de Tareas  ·  backend/server.js
 * ============================================================
 *  Convención de etiquetas (para buscar en el código y en el commit):
 *    [LOG]    -> logs visibles en la terminal de Docker (docker logs -f <contenedor>)
 *    [RETO]   -> Reto Autónomo: eliminación total de tareas
 *    [KANBAN] -> campo "estado" y ruta PATCH del tablero kanban
 *    [DB]     -> Reto adicional: persistencia en PostgreSQL (reemplaza la memoria RAM)
 *
 *  Buscar en el código:  grep -n "\[LOG\]\|\[RETO\]\|\[KANBAN\]\|\[DB\]" server.js
 */
const express = require('express');
const cors = require('cors'); // (antes era una variable global implícita: "cors = require(...)")
const app = express();
const PORT = 5000;

// [DB] INICIO · Conexión a PostgreSQL
// Se usa un Pool (conjunto de conexiones reutilizables). Los datos de conexión llegan
// por variables de entorno definidas en docker-compose.yml (DB_HOST=db es el nombre del servicio).
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
// [DB] FIN

app.use(cors());
app.use(express.json()); // Habilita la lectura de JSON en el cuerpo (body) de las peticiones
app.use((req, res, next) => { // Configuración de CORS para permitir solicitudes desde cualquier origen
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// ------------------------------------------------------------
// [LOG] Helper de logging
// console.log escribe en stdout, que Docker captura y muestra con "docker logs".
// Formato: [2026-10-08T15:04:05.000Z] [TIPO] mensaje
// ------------------------------------------------------------
const log = (tipo, mensaje) =>
  console.log(`[${new Date().toISOString()}] [${tipo}] ${mensaje}`);

// ------------------------------------------------------------
// [LOG] Middleware de trazabilidad de peticiones
// Registra CADA petición HTTP (GET, POST, DELETE, PATCH...) con su ruta,
// el código de respuesta y el tiempo que tardó. Se ejecuta antes de las rutas.
// Ejemplo de salida:  [REQ] GET /api/tareas -> 200 (3ms)
// ------------------------------------------------------------
app.use((req, res, next) => {
  const inicio = Date.now();
  // 'finish' se dispara cuando la respuesta ya se envió: ahí conocemos el status
  res.on('finish', () => {
    log('REQ', `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
  });
  next();
});

// [DB] ANTES: let tareas = [...] guardaba las tareas en la memoria RAM (se perdían al reiniciar).
// [DB] AHORA: se guardan en la tabla "tareas" de PostgreSQL (se crea en iniciar(), al final del archivo).

// [GET] Obtener la lista completa de tareas
app.get('/api/tareas', async (req, res) => { // [DB] ahora es async
  try { // [DB] try/catch: si la consulta falla, se responde 500 en vez de tumbar el servidor
    const { rows: tareas } = await pool.query('SELECT id, texto, estado FROM tareas ORDER BY id'); // [DB] SELECT
    log('GET', `Consulta de tareas (${tareas.length} registradas)`); // [LOG]
    res.json(tareas);
  } catch (e) { errorDB(res, e); } // [DB]
});

// [POST] Crear una nueva tarea
app.post('/api/tareas', async (req, res) => { // [DB] ahora es async
  try {
    // [DB] INSERT parametrizado ($1, $2): el texto del usuario nunca se concatena en el SQL
    const { rows } = await pool.query(
      "INSERT INTO tareas (id, texto, estado) VALUES ($1, $2, 'pendiente') RETURNING id, texto, estado", // [KANBAN] estado inicial
      [Date.now(), req.body.texto]
    );
    const nuevaTarea = rows[0];
    log('POST', `Tarea creada id=${nuevaTarea.id} texto="${nuevaTarea.texto}"`); // [LOG]
    res.status(201).json(nuevaTarea);
  } catch (e) { errorDB(res, e); } // [DB]
});

// [RETO] [DELETE] Eliminar TODAS las tareas (eliminación total)
// Va ANTES de '/api/tareas/:id' por orden lógico; no hay conflicto porque esta ruta no lleva id.
app.delete('/api/tareas', async (req, res) => { // [DB] ahora es async
  try {
    const { rowCount: eliminadas } = await pool.query('DELETE FROM tareas'); // [DB] antes: tareas = []
    log('DELETE', `Eliminación total: ${eliminadas} tareas borradas`); // [LOG]
    res.json({ mensaje: "Todas las tareas fueron eliminadas", eliminadas });
  } catch (e) { errorDB(res, e); } // [DB]
});

// [DELETE] Eliminar una tarea específica mediante su ID en la URL
app.delete('/api/tareas/:id', async (req, res) => { // [DB] ahora es async
  const idEliminar = parseInt(req.params.id);
  try {
    // [DB] DELETE ... WHERE id = $1; rowCount > 0 indica que la tarea existía (antes: some + filter)
    const { rowCount } = await pool.query('DELETE FROM tareas WHERE id = $1', [idEliminar]);
    const existia = rowCount > 0;
    // [LOG] distingue si el id existía o no
    log('DELETE', existia
      ? `Tarea eliminada id=${idEliminar}`
      : `Intento de eliminar id=${idEliminar} (no existe)`);
    res.json({ mensaje: "Tarea eliminada correctamente" });
  } catch (e) { errorDB(res, e); } // [DB]
});

// [KANBAN] [PATCH] Actualizar el estado de una tarea específica mediante su ID en la URL
app.patch('/api/tareas/:id', async (req, res) => { // [DB] ahora es async
  try {
    // [DB] SELECT para conocer el estado anterior (se usa en el log) y comprobar que la tarea existe
    const previo = await pool.query('SELECT estado FROM tareas WHERE id = $1', [parseInt(req.params.id)]);
    if (previo.rowCount === 0) {
      log('PATCH', `id=${req.params.id} no existe`); // [LOG]
      return res.status(404).json({ mensaje: "No existe" });
    }
    const anterior = previo.rows[0].estado;
    // [DB] UPDATE parametrizado; "estado" = "pendiente" | "progreso" | "hecho"
    const { rows } = await pool.query(
      'UPDATE tareas SET estado = $1 WHERE id = $2 RETURNING id, texto, estado',
      [req.body.estado, parseInt(req.params.id)]
    );
    const tarea = rows[0];
    log('PATCH', `Tarea id=${tarea.id} movida: ${anterior} -> ${tarea.estado}`); // [LOG]
    res.json(tarea);
  } catch (e) { errorDB(res, e); } // [DB]
});

// [DB] INICIO · Manejo de errores y arranque
// Respuesta común cuando una consulta SQL falla (se registra en el log de Docker).
const errorDB = (res, e) => {
  log('ERROR', `Consulta fallida: ${e.message}`); // [LOG]
  res.status(500).json({ mensaje: "Error de base de datos" });
};

// Crea la tabla si no existe y SOLO después abre el puerto, así la API no responde sin base de datos.
// (docker-compose espera con un healthcheck a que PostgreSQL esté listo antes de iniciar este servicio.)
async function iniciar() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS tareas (
      id     BIGINT PRIMARY KEY,
      texto  TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente'
    )`);
    log('DB', 'Conectado a PostgreSQL, tabla "tareas" lista'); // [LOG]
    app.listen(PORT, () => log('SERVER', `API REST corriendo en el puerto ${PORT}`)); // [LOG] antes: app.listen directo
  } catch (e) {
    log('ERROR', `No se pudo conectar a PostgreSQL: ${e.message}`); // [LOG]
    process.exit(1);
  }
}
iniciar();
// [DB] FIN
