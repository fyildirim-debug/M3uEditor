const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock CategoryService
const mockCategoryService = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateOrder: jest.fn(),
  delete: jest.fn(),
  _verifyPlaylistOwnership: jest.fn(),
  _verifyCategoryOwnership: jest.fn(),
};
jest.mock('../../../src/services/CategoryService', () => mockCategoryService);

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';
const CATEGORY_ID = 'category-uuid-1';

describe('Category Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/playlists/:id/categories', () => {
    it('should return categories for a playlist', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Spor', sort_order: 0 },
        { id: 'cat-2', name: 'Haber', sort_order: 1 },
      ];
      mockCategoryService.list.mockResolvedValue(mockCategories);

      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/categories`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Spor');
      expect(mockCategoryService.list).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/categories`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/playlists/:id/categories', () => {
    it('should create a category', async () => {
      const mockCategory = { id: CATEGORY_ID, name: 'Film', sort_order: 0 };
      mockCategoryService.create.mockResolvedValue(mockCategory);

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/categories`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Film' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Film');
      expect(mockCategoryService.create).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID, 'Film');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/categories`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty name', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/categories`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/categories`)
        .send({ name: 'Film' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('should update a category', async () => {
      const mockCategory = { id: CATEGORY_ID, name: 'Spor Kanalları' };
      mockCategoryService.update.mockResolvedValue(mockCategory);

      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Spor Kanalları' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Spor Kanalları');
      expect(mockCategoryService.update).toHaveBeenCalledWith(USER_ID, CATEGORY_ID, 'Spor Kanalları');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category and return 204', async () => {
      mockCategoryService.delete.mockResolvedValue();

      const res = await request(app)
        .delete(`/api/categories/${CATEGORY_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockCategoryService.delete).toHaveBeenCalledWith(USER_ID, CATEGORY_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .delete(`/api/categories/${CATEGORY_ID}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/categories/:id/order', () => {
    it('should update category order', async () => {
      mockCategoryService.updateOrder.mockResolvedValue();

      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockCategoryService.updateOrder).toHaveBeenCalledWith(USER_ID, CATEGORY_ID, 2);
    });

    it('should return 400 for invalid newPosition', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for negative newPosition', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when newPosition is missing', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_ID}/order`)
        .send({ newPosition: 0 });

      expect(res.status).toBe(401);
    });
  });
});
