import express from 'express';
import multer from 'multer';
import prisma from '../prismaClient.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = express.Router();


const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'image/png',
      'image/jpeg'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, TXT, PNG, and JPG files are allowed.'));
    }
    cb(null, true);
  }
});


router.post(
  '/submit',
  authRequired,
  requireRoles('DEFENDANT', 'PLAINTIFF'),
  upload.single('evidenceFile'),
  async (req, res) => {
    try {
      const { title, argument, evidenceText } = req.body;
      if (!title || !argument || !evidenceText) {
        return res.status(400).json({ message: 'Title, argument and evidenceText are required' });
      }

      const evidenceFile = req.file ? req.file.filename : null;

      const courtCase = await prisma.courtCase.create({
        data: {
          title,
          argument,
          evidenceText,
          evidenceFile,
          status: 'PENDING',
          submittedById: req.user.id
        }
      });

      return res.json({
        message: 'Case submitted successfully (pending judge approval)',
        case: courtCase
      });
    } catch (err) {
      console.error('Submit case error', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large (max 5MB)' });
      }
      if (err.message?.includes('Only PDF')) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Error submitting case' });
    }
  }
);


router.get('/all', authRequired, async (req, res) => {
  try {
    const where = {};


    if (req.user.role === 'JUROR') {
      where.status = 'APPROVED';
    }

    const cases = await prisma.courtCase.findMany({
      where,
      include: { submittedBy: true },
      orderBy: { id: 'desc' }
    });

    return res.json(cases);
  } catch (err) {
    console.error('Get cases error', err);
    return res.status(500).json({ message: 'Failed to fetch cases' });
  }
});


router.get('/by-name/:name', authRequired, requireRoles('JUROR'), async (req, res) => {
  try {
    const name = req.params.name;
    const cases = await prisma.courtCase.findMany({
      where: {
        status: 'APPROVED',
        submittedBy: { name: { contains: name, mode: 'insensitive' } }
      },
      include: { submittedBy: true },
      orderBy: { id: 'desc' }
    });
    return res.json(cases);
  } catch (err) {
    console.error('Get cases by name error', err);
    return res.status(500).json({ message: 'Failed to fetch cases' });
  }
});


router.patch('/edit/:id', authRequired, requireRoles('JUDGE'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.courtCase.update({
      where: { id },
      data: req.body
    });
    return res.json({ message: 'Case updated', updated });
  } catch (err) {
    console.error('Edit case error', err);
    return res.status(400).json({ message: 'Error updating case' });
  }
});


router.delete('/delete/:id', authRequired, requireRoles('JUDGE'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.courtCase.delete({ where: { id } });
    return res.json({ message: 'Case deleted' });
  } catch (err) {
    console.error('Delete case error', err);
    return res.status(400).json({ message: 'Error deleting case' });
  }
});


router.patch('/approve/:id', authRequired, requireRoles('JUDGE'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.courtCase.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
    return res.json({ message: 'Case approved', updated });
  } catch (err) {
    console.error('Approve case error', err);
    return res.status(400).json({ message: 'Error approving case' });
  }
});


router.patch('/reject/:id', authRequired, requireRoles('JUDGE'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.courtCase.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    return res.json({ message: 'Case rejected', updated });
  } catch (err) {
    console.error('Reject case error', err);
    return res.status(400).json({ message: 'Error rejecting case' });
  }
});

export default router;
