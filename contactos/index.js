import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
const port = 3000;

app.use(express.json());
// Habilitar CORS para todas las rutas
app.use(cors());


// ---- Conexión a Mongo (una sola vez) ----
const uri = 'mongodb+srv://glu_db_user:8aa8ii1oo1@cluster0.te6deme.mongodb.net/';
const dbName = 'ProviSys';

// Clave secreta para JWT
const SECRET_KEY = "MIDDLE-DEEP-HOME-TOOK-FLOOR";
const EXPIRES_IN = "24h";

// USUARIOS---> APARTADO DE LA API PARA CARGAR DATOS DE USUARIOS
let usuarios; // colección compartida por las rutas
let productos; // colección compartida por las rutas
let posts;
let proveedores;

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a MongoDB');

  const db = client.db(dbName);
  usuarios = db.collection('usuarios');
  productos = db.collection('productos');
  posts = db.collection('posts');
  proveedores = db.collection('proveedores');

  // 👉 Ruta raíz de cortesía
  app.get('/', (req, res) => res.send('API Usuarios activa. Prueba GET /usuarios'));

  // 📄 GET /usuarios → listar todos
  app.get('/usuarios', async (req, res) => {
    const docs = await usuarios.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

  // GET /productos -> obtener uno por id_product
  app.get('/productos', async (req, res) => {
    const docs = await productos.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

  app.get('/posts',async (req,res)=>{
    const docs=await posts.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

    app.post('/registrar', async (req, res) => {
    const { name, email, profile_picture, password } = req.body;

    if (!name || !email || !profile_picture || !password)
      return res.status(400).json({ error: 'nombre, email, foto de perfil y contraseña son obligatorios' });

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Generar un id_user único
    const ultimoUsuario = await usuarios.find().sort({ id_user: -1 }).limit(1).toArray();
    const nuevoIdUser = ultimoUsuario.length > 0 ? ultimoUsuario[0].id_user + 1 : 1;

    const nuevo = { id_user: nuevoIdUser, name, email, profile_picture, passwordHash };

    const r = await usuarios.insertOne(nuevo);
    res.status(201).json({ id_user: nuevoIdUser, ...nuevo });
  });
  
  app.post('/Login', async (req, res) => {
      const { name, password } = req.body;

      // Buscar usuario por name
      const db_user = await usuarios.findOne({ name });

      if (!db_user) {
        return res.status(400).json({ detail: "Nombre de usuario incorrecto" });
      }

      // Comprobar contraseña
      const passwordMatch = await bcrypt.compare(password, db_user.passwordHash);


      if (!passwordMatch) {
        return res.status(400).json({ detail: "Contraseña incorrecta" });
      }

      // Crear token
      const token = jwt.sign(
        { sub: String(db_user.id_user) },
        SECRET_KEY,
        { expiresIn: EXPIRES_IN }
      );

      return res.json({
        message: "Login exitoso",
        usuario: db_user.nombre_usuario,
        access_token: token,
        token_type: "bearer",
      });
    });

    app.get('/usuarios/me', async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

      // Obtener el token del header "Bearer <token>"
      const token = authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Token inválido' });

      try {
        // Verificar token JWT
        const payload = jwt.verify(token, SECRET_KEY);

        // Buscar usuario por id_user almacenado en el token
        const usuario = await usuarios.findOne({ id_user: parseInt(payload.sub) });

        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Devolver solo los campos que quieras exponer
        res.json({id_user: usuario.id_user,});
      } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Token inválido o expirado' });
      }
    });

    // 🔎 GET /usuarios/:id_user → obtener uno por id_user
    app.get('/usuarios/:id_user', async (req, res) => {
      const { id_user } = req.params;
      const id = parseInt(id_user);
      const doc = await usuarios.findOne({ id_user: id });

      //console.log(doc);
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    });
//PROVEEDORES--> APARTADO DE LA API PARA CARGAR DATOS DE PROVEEDORES

  app.get('/proveedores', async (req, res) => {
    try {
      const docs = await proveedores.find().toArray();
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener proveedores' });
    }
  });

  app.get('/proveedores/:id_provider', async (req, res) => {
    const { id_provider } = req.params;
    const id = parseInt(id_provider);
    const doc = await proveedores.findOne({ id_provider: id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  app.get('/proveedores/porUser/:id_user', async (req, res) => {
    const { id_provider } = req.params;
    const id = parseInt(id_provider);
    const doc = await proveedores.findOne({ id_user: id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // GET /productos/:id_product -> obtener uno por id_product
  app.get('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    const id = parseInt(id_product);
    const doc = await productos.findOne({ id_product: id });
    //console.log(doc);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // POST /Productos → crear
  app.post('/productos', async (req, res) => {
    const { name, description, price } = req.body;
    if (!name || !description || !price) return res.status(400).json({ error: 'nombre, descripción y precio son obligatorios' });
    const nuevo = { name, description, category, price, quantity, images, status, createdAt, updatedAt };
    const r = await productos.insertOne(nuevo);
    res.status(201).json({ id_product: r.insertedId, ...nuevo });
  });

  // 🔁 PUT /usuarios/:id_user → actualizar (parcial: solo campos enviados)
  app.put('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const { name, email, profile_picture } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email  !== undefined) set.email  = email;
    if (profile_picture !== undefined) set.profile_picture = profile_picture;

    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await usuarios.updateOne({ _id: new ObjectId(id_user) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    const actualizado = await usuarios.findOne({ _id: new ObjectId(id_user) });
    res.json(actualizado);
  });

  // PUT /productos/:id_product → actualizar (parcial: solo campos enviados)
  app.put('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const { name, description, price } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (description  !== undefined) set.description  = description;
    if (price !== undefined) set.price = price;
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await productos.updateOne({ _id: new ObjectId(id_product) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    const actualizado = await productos.findOne({ _id: new ObjectId(id_product) });
    res.json(actualizado);
  });

  // ❌ DELETE /usuarios/:id_user → borrar
  app.delete('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const r = await usuarios.deleteOne({ _id: new ObjectId(id_user) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    res.status(204).send();
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