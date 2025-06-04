// Initialisation Firebase PROD
const firebaseConfig = {
    apiKey: "AIzaSy***************",
    authDomain: "waythes-calendrier.firebaseapp.com",
    databaseURL: "https://waythes-calendrier-default-rtdb.firebaseio.com",
    projectId: "waythes-calendrier",
    storageBucket: "waythes-calendrier.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Exemple : affichage d’un événement
function afficherEvenements() {
    db.ref("events").once("value", (snapshot) => {
        const container = document.getElementById("calendar-container");
        container.innerHTML = "";
        snapshot.forEach((child) => {
            const div = document.createElement("div");
            div.textContent = child.key + " : " + JSON.stringify(child.val());
            container.appendChild(div);
        });
    });
}
window.onload = afficherEvenements;
