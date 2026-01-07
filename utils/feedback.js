/**
 * User Feedback Service
 * 
 * Handles user feedback collection and storage.
 * 
 * @module utils/feedback
 * @version 1.0.0
 */

const prisma = require('./prisma').default;

/**
 * Submit user feedback
 * 
 * @param {Object} feedbackData - Feedback data
 * @param {string} feedbackData.userId - User ID (optional)
 * @param {string} feedbackData.email - User email (optional)
 * @param {string} feedbackData.type - Feedback type ('bug', 'feature', 'improvement', 'other')
 * @param {string} feedbackData.message - Feedback message
 * @param {string} feedbackData.rating - Rating (1-5, optional)
 * @param {Object} feedbackData.metadata - Additional metadata (optional)
 * 
 * @returns {Promise<Object>} Created feedback
 */
async function submitFeedback(feedbackData) {
  const {
    userId,
    email,
    type = 'other',
    message,
    rating,
    metadata = {},
  } = feedbackData;

  if (!message || message.trim().length === 0) {
    throw new Error('Feedback message is required');
  }

  const validTypes = ['bug', 'feature', 'improvement', 'other'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid feedback type. Must be one of: ${validTypes.join(', ')}`);
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: userId || null,
      email: email || null,
      type,
      message: message.trim(),
      rating: rating || null,
      metadata,
    },
  });

  return feedback;
}

/**
 * Get feedback by ID
 * 
 * @param {string} feedbackId - Feedback ID
 * @returns {Promise<Object|null>} Feedback or null
 */
async function getFeedbackById(feedbackId) {
  return await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Query feedback with filters
 * 
 * @param {Object} filters - Query filters
 * @param {string} filters.type - Filter by type
 * @param {string} filters.userId - Filter by user ID
 * @param {number} filters.minRating - Minimum rating
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {number} filters.limit - Result limit (default: 50, max: 100)
 * @param {number} filters.offset - Result offset
 * @param {string} filters.sortBy - Sort field (default: 'createdAt')
 * @param {string} filters.sortOrder - Sort order ('asc' | 'desc', default: 'desc')
 * 
 * @returns {Promise<Object>} Query results
 */
async function queryFeedback(filters = {}) {
  const {
    type,
    userId,
    minRating,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const where = {};

  if (type) {
    where.type = type;
  }

  if (userId) {
    where.userId = userId;
  }

  if (minRating !== undefined) {
    where.rating = {
      gte: minRating,
    };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  const [feedback, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy,
      take: Math.min(limit, 100),
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  return {
    feedback,
    total,
    limit,
    offset,
    hasMore: offset + feedback.length < total,
  };
}

/**
 * Get feedback statistics
 * 
 * @param {Object} filters - Query filters (same as queryFeedback)
 * @returns {Promise<Object>} Statistics
 */
async function getFeedbackStatistics(filters = {}) {
  const { startDate, endDate } = filters;

  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [
    totalFeedback,
    feedbackByType,
    averageRating,
    ratingDistribution,
    recentFeedback,
  ] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
    }),
    prisma.feedback.aggregate({
      where: {
        ...where,
        rating: { not: null },
      },
      _avg: { rating: true },
    }),
    prisma.feedback.groupBy({
      by: ['rating'],
      where: {
        ...where,
        rating: { not: null },
      },
      _count: { rating: true },
    }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        rating: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalFeedback,
    feedbackByType: feedbackByType.reduce((acc, item) => {
      acc[item.type] = item._count.type;
      return acc;
    }, {}),
    averageRating: averageRating._avg.rating || 0,
    ratingDistribution: ratingDistribution.reduce((acc, item) => {
      acc[item.rating] = item._count.rating;
      return acc;
    }, {}),
    recentFeedback,
  };
}

/**
 * Update feedback status
 * 
 * @param {string} feedbackId - Feedback ID
 * @param {string} status - New status ('new', 'reviewed', 'resolved', 'archived')
 * @returns {Promise<Object>} Updated feedback
 */
async function updateFeedbackStatus(feedbackId, status) {
  const validStatuses = ['new', 'reviewed', 'resolved', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  return await prisma.feedback.update({
    where: { id: feedbackId },
    data: { status },
  });
}

module.exports = {
  submitFeedback,
  getFeedbackById,
  queryFeedback,
  getFeedbackStatistics,
  updateFeedbackStatus,
};
