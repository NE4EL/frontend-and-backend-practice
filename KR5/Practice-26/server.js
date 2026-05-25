import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

// ===== IN-MEMORY DATA STORE =====
let authorIdSeq = 3;
let bookIdSeq   = 6;

const authors = [
  { id: '1', name: 'Лев Толстой' },
  { id: '2', name: 'Фёдор Достоевский' },
  { id: '3', name: 'Михаил Булгаков' },
];

const books = [
  { id: '1', title: 'Война и мир',          year: 1869, authorId: '1' },
  { id: '2', title: 'Анна Каренина',         year: 1878, authorId: '1' },
  { id: '3', title: 'Преступление и наказание', year: 1866, authorId: '2' },
  { id: '4', title: 'Идиот',                 year: 1869, authorId: '2' },
  { id: '5', title: 'Мастер и Маргарита',    year: 1967, authorId: '3' },
  { id: '6', title: 'Белая гвардия',         year: 1925, authorId: '3' },
];

// ===== SCHEMA =====
const typeDefs = `#graphql
  type Author {
    id: ID!
    name: String!
    books: [Book!]!
  }

  type Book {
    id: ID!
    title: String!
    year: Int
    author: Author!
  }

  type Query {
    """Список всех книг"""
    books: [Book!]!
    """Книга по ID"""
    book(id: ID!): Book
    """Список всех авторов"""
    authors: [Author!]!
    """Автор по ID"""
    author(id: ID!): Author
  }

  type Mutation {
    """Создать автора"""
    createAuthor(name: String!): Author!
    """Создать книгу"""
    createBook(title: String!, year: Int, authorId: ID!): Book!
  }
`;

// ===== RESOLVERS =====
const resolvers = {
  Query: {
    books:   () => books,
    book:    (_, { id }) => books.find(b => b.id === id) ?? null,
    authors: () => authors,
    author:  (_, { id }) => authors.find(a => a.id === id) ?? null,
  },

  Mutation: {
    createAuthor: (_, { name }) => {
      const author = { id: String(++authorIdSeq), name };
      authors.push(author);
      return author;
    },
    createBook: (_, { title, year, authorId }) => {
      if (!authors.find(a => a.id === authorId)) {
        throw new Error(`Автор с id=${authorId} не найден`);
      }
      const book = { id: String(++bookIdSeq), title, year: year ?? null, authorId };
      books.push(book);
      return book;
    },
  },

  // Nested resolvers
  Book: {
    author: (book) => authors.find(a => a.id === book.authorId),
  },
  Author: {
    books: (author) => books.filter(b => b.authorId === author.id),
  },
};

// ===== SERVER =====
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`
🚀 TechStore GraphQL Server запущен: ${url}
📚 Apollo Sandbox: ${url}

Примеры запросов:
  query { books { id title year author { name } } }
  query { authors { name books { title } } }
  mutation { createAuthor(name: "Чехов") { id name } }
  mutation { createBook(title: "Степь", year: 1888, authorId: "4") { id title author { name } } }
`);
