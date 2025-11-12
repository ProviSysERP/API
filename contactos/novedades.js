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

let productos; // colección compartida por las rutas

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a MongoDB');

  const db = client.db(dbName);
  productos = db.collection('productos');

  // 👉 Ruta raíz de cortesía
  app.get('/', (req, res) => res.send('API productos activa. Prueba GET /productos'));

  // 📄 GET /productos → listar todos
  app.get('/productos', async (req, res) => {
    const docs = await productos.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  // 🔎 GET /productos/:id_product → obtener uno por id_product
  app.get('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const doc = await productos.findOne({ _id: new ObjectId(id_product) });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // ➕ POST /productos → crear
  app.post('/productos', async (req, res) => {
    const { name, email, profile_picture } = req.body;
    if (!name || !email || !profile_picture) return res.status(400).json({ error: 'nombre, email y foto de perfil son obligatorios' });

    const nuevo = { name, email, profile_picture };
    const r = await productos.insertOne(nuevo);
    res.status(201).json({ id_product: r.insertedId, ...nuevo });
  });

  // 🔁 PUT /productos/:id_product → actualizar (parcial: solo campos enviados)
  app.put('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const { name, email, profile_picture } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email  !== undefined) set.email  = email;
    if (profile_picture !== undefined) set.profile_picture = profile_picture;

    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await productos.updateOne({ _id: new ObjectId(id_product) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    const actualizado = await productos.findOne({ _id: new ObjectId(id_product) });
    res.json(actualizado);
  });

  // ❌ DELETE /productos/:id_product → borrar
  app.delete('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const r = await productos.deleteOne({ _id: new ObjectId(id_product) });
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