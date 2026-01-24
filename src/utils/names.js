const FIRST_NAMES = [
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

const LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
    "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
    "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
    "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira"
];

const LOCATIONS = [
    "Heliópolis",
    "Sacomã",
    "Ipiranga",
    "São Caetano",
    "Saúde",
    "São João Clímaco",
    "Vila Heliópolis",
    "Jardim São Savério",
    "Vila das Mercês",
    "Cursino"
];

const getRandomName = () => {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    // Sometimes add a second surname for realism (30% chance)
    if (Math.random() > 0.7) {
        const last2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        return `${first} ${last} ${last2}`;
    }
    return `${first} ${last}`;
};

const getRandomLocation = () => {
    return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
};

const getComplexIdentity = () => {
    return {
        name: getRandomName(),
        location: getRandomLocation()
    };
};

module.exports = { getRandomName, getRandomLocation, getComplexIdentity };
