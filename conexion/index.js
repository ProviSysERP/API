import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(express.json());
// Habilitar CORS para todas las rutas
app.use(cors());


// ---- Conexión a Mongo (una sola vez) ----
const uri = 'mongodb+srv://glu_db_user:8aa8ii1oo1@cluster0.te6deme.mongodb.net/';
const dbName = 'ProviSys';

let usuarios; // colección compartida por las rutas

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a MongoDB');

  const db = client.db(dbName);
  usuarios = db.collection('usuarios');

  // 👉 Ruta raíz de cortesía
  app.get('/', (req, res) => res.send('API Usuarios activa. Prueba GET /usuarios'));

  // 📄 GET /usuarios → listar todos
  app.get('/usuarios', async (req, res) => {
    const docs = await usuarios.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  // 🔎 GET /usuarios/:id_user → obtener uno por id_user
  app.get('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const doc = await usuarios.findOne({ id_user: new ObjectId(id_user) });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // ➕ POST /usuarios → crear
  app.post('/usuarios', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'nombre y email son obligatorios' });

    const nuevo = { name, email };
    const r = await usuarios.insertOne(nuevo);
    res.status(201).json({ id_user: r.insertedId, ...nuevo });
  });

  // 🔁 PUT /usuarios/:id_user → actualizar (parcial: solo campos enviados)
  app.put('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const { name, email } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email  !== undefined) set.email  = email;


    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await usuarios.updateOne({ id_user: new ObjectId(id_user) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    const actualizado = await usuarios.findOne({ id_user: new ObjectId(id_user) });
    res.json(actualizado);
  });

  // ❌ DELETE /usuarios/:id_user → borrar
  app.delete('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const r = await usuarios.deleteOne({ id_user: new ObjectId(id_user) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    res.status(204).send();
  });

  // ▶️ Arrancar Express
  app.listen(port, () => {
    console.log(`🚀 API escuchando en http://localhost:${port}`);
  });
}

// Iniciar conexión + rutas
init().catch(err => {
  console.error('❌ Error iniciando:', err);
  process.exit(1);
});