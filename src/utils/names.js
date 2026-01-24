const COMMON_NAMES = [
    "Miguel", "Arthur", "Gael", "Théo", "Heitor", "Ravi", "Davi", "Bernardo", "Noah", "Gabriel",
    "Samuel", "Pedro", "Anthony", "Isaac", "Benício", "Benjamin", "Matheus", "Lucas", "Joaquim", "Nicolas",
    "Lucca", "Henrique", "João", "Rafael", "Guilherme", "Enzo", "Murilo", "Benjamim", "Gustavo", "Felipe",
    "Helena", "Alice", "Laura", "Maria", "Sophia", "Manuela", "Maitê", "Liz", "Cecília", "Isabella",
    "Luísa", "Eloá", "Heloísa", "Júlia", "Ayla", "Madalena", "Isis", "Elisa", "Antonella", "Valentina",
    "Maya", "Maria Alice", "Aurora", "Lara", "Maria Luísa", "Esther", "Maria Clara", "Mirella", "Sarah",
    "Ana", "Lorena", "Lívia", "Agatha", "Alana", "Olívia", "Beatriz", "Luna", "Maria Júlia", "Bárbara",
    "Carlos", "Daniel", "Eduardo", "Fernando", "Giovanni", "Hugo", "Igor", "Jorge", "Kauê", "Leonardo",
    "Marcos", "Nathan", "Otávio", "Paulo", "Quintino", "Ricardo", "Sérgio", "Tiago", "Ubirajara", "Vinícius",
    "Wagner", "Xavier", "Yuri", "Zeca", "Amanda", "Bianca", "Camila", "Daniela", "Eduarda", "Fernanda",
    "Gabriela", "Heloisa", "Ingrid", "Jéssica", "Karina", "Larissa", "Mariana", "Nicole", "Patrícia", "Quezia",
    "Rafaela", "Sabrina", "Tatiane", "Ursula", "Vitória", "Yasmin", "Zuleica"
];

const getRandomName = () => {
    return COMMON_NAMES[Math.floor(Math.random() * COMMON_NAMES.length)];
};

module.exports = { COMMON_NAMES, getRandomName };
