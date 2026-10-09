/*
 * ============================================================
 *  API REST de Tareas  ·  backend/server.js
 * ============================================================
 *  Convención de etiquetas (para buscar en el código y en el commit):
 *    [LOG]    -> logs visibles en la terminal de Docker (docker logs -f <contenedor>)
 *    [RETO]   -> Reto Autónomo: eliminación total de tareas
 *    [KANBAN] -> campo "estado" y ruta PATCH del tablero kanban
 *
 *  Buscar en el código:  grep -n "\[LOG\]\|\[RETO\]\|\[KANBAN\]" server.js
 */
const express = require('express');
const cors = require('cors'); // (antes era una variable global implícita: "cors = require(...)")
const app = express();
const PORT = 5000;

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

// Simulación de Base de Datos en memoria
let tareas = [
  { id: 1, texto: "Aprender conceptos básicos de Docker", estado: "pendiente" }, // [KANBAN] anexo de estado de la tarea
  { id: 2, texto: "Desplegar mi primer arquitectura de Microservicios", estado: "pendiente" } // [KANBAN] anexo de estado de la tarea
];

// [GET] Obtener la lista completa de tareas
app.get('/api/tareas', (req, res) => {
  log('GET', `Consulta de tareas (${tareas.length} registradas)`); // [LOG]
  res.json(tareas);
});

// [POST] Crear una nueva tarea
app.post('/api/tareas', (req, res) => {
  const nuevaTarea = { id: Date.now(), texto: req.body.texto, estado: "pendiente" }; // [KANBAN] estado inicial
  tareas.push(nuevaTarea);
  log('POST', `Tarea creada id=${nuevaTarea.id} texto="${nuevaTarea.texto}"`); // [LOG]
  res.status(201).json(nuevaTarea);
});

// [RETO] [DELETE] Eliminar TODAS las tareas (eliminación total)
// Va ANTES de '/api/tareas/:id' por orden lógico; no hay conflicto porque esta ruta no lleva id.
app.delete('/api/tareas', (req, res) => {
  const eliminadas = tareas.length;
  tareas = [];                                                   // vaciamos el arreglo en memoria
  log('DELETE', `Eliminación total: ${eliminadas} tareas borradas`); // [LOG]
  res.json({ mensaje: "Todas las tareas fueron eliminadas", eliminadas });
});

// [DELETE] Eliminar una tarea específica mediante su ID en la URL
app.delete('/api/tareas/:id', (req, res) => {
  const idEliminar = parseInt(req.params.id);
  const existia = tareas.some(t => t.id === idEliminar);
  tareas = tareas.filter(t => t.id !== idEliminar);
  // [LOG] distingue si el id existía o no
  log('DELETE', existia
    ? `Tarea eliminada id=${idEliminar}`
    : `Intento de eliminar id=${idEliminar} (no existe)`);
  res.json({ mensaje: "Tarea eliminada correctamente" });
});

// [KANBAN] [PATCH] Actualizar el estado de una tarea específica mediante su ID en la URL
app.patch('/api/tareas/:id', (req, res) => {
  const tarea = tareas.find(t => t.id === parseInt(req.params.id));
  if (!tarea) {
    log('PATCH', `id=${req.params.id} no existe`); // [LOG]
    return res.status(404).json({ mensaje: "No existe" });
  }
  const anterior = tarea.estado;
  tarea.estado = req.body.estado;   // "pendiente" | "progreso" | "hecho"
  log('PATCH', `Tarea id=${tarea.id} movida: ${anterior} -> ${tarea.estado}`); // [LOG]
  res.json(tarea);
});

app.listen(PORT, () => log('SERVER', `API REST corriendo en el puerto ${PORT}`)); // [LOG]
