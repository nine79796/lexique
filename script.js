fetch("/api/firebase")
  .then(res => res.json())
  .then(data => {
    console.log("Données récupérées :", data);
    // Ici tu peux mettre à jour le DOM
    // ex: document.getElementById('result').textContent = JSON.stringify(data);
  });