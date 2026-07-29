const mockCategoryService = {
  update: jest.fn(),
};

jest.mock('../../../src/services/CategoryService', () => mockCategoryService);

const { updateCategory } = require('../../../src/controllers/categoryController');

function responseMock() {
  return {
    json: jest.fn(),
  };
}

describe('categoryController.updateCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('accepts is_hidden as a standalone partial update', async () => {
    const category = { id: 'category-1', name: 'News', is_hidden: true };
    mockCategoryService.update.mockResolvedValue(category);
    const req = {
      userId: 'user-1',
      params: { id: 'category-1' },
      body: { is_hidden: true },
    };
    const res = responseMock();
    const next = jest.fn();

    await updateCategory(req, res, next);

    expect(mockCategoryService.update).toHaveBeenCalledWith(
      'user-1',
      'category-1',
      { is_hidden: true }
    );
    expect(res.json).toHaveBeenCalledWith(category);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects non-boolean visibility values', async () => {
    const req = {
      userId: 'user-1',
      params: { id: 'category-1' },
      body: { is_hidden: 'true' },
    };
    const res = responseMock();
    const next = jest.fn();

    await updateCategory(req, res, next);

    expect(mockCategoryService.update).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
