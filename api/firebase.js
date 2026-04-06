export default async function handler(req, res) {
  const API_KEY = process.env.FIREBASE_API_KEY;

  // Exemple simple pour tester
  res.status(200).json({ message: "Clé sécurisée côté serveur", keyLength: API_KEY.length });
}
