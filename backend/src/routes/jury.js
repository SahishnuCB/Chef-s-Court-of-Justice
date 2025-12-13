import express from 'express';
import prisma from '../prismaClient.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = express.Router();


router.post('/vote/:caseId', authRequired, requireRoles('JUROR'), async (req, res) => {
  try {
    const caseId = Number(req.params.caseId);
    const { verdict } = req.body;

    if (!['GUILTY', 'NOT_GUILTY'].includes(verdict)) {
      return res.status(400).json({ message: 'Invalid verdict' });
    }


    const courtCase = await prisma.courtCase.findUnique({ where: { id: caseId } });
    if (!courtCase || courtCase.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Can only vote on approved cases' });
    }


    const existing = await prisma.juryVote.findUnique({
      where: { caseId_jurorId: { caseId, jurorId: req.user.id } }
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already voted on this case' });
    }

    await prisma.juryVote.create({
      data: {
        caseId,
        jurorId: req.user.id,
        verdict
      }
    });

    return res.json({ message: 'Vote submitted' });
  } catch (err) {
    console.error('Vote error', err);
    return res.status(500).json({ message: 'Failed to submit vote' });
  }
});


router.get('/results/:caseId', authRequired, requireRoles('JUROR', 'JUDGE'), async (req, res) => {
  try {
    const caseId = Number(req.params.caseId);

    const votes = await prisma.juryVote.findMany({
      where: { caseId }
    });

    const totalVotes = votes.length;
    const guilty = votes.filter(v => v.verdict === 'GUILTY').length;
    const notGuilty = votes.filter(v => v.verdict === 'NOT_GUILTY').length;

    return res.json({ totalVotes, guilty, notGuilty });
  } catch (err) {
    console.error('Results error', err);
    return res.status(500).json({ message: 'Failed to fetch results' });
  }
});

export default router;
