import express from 'express';
import prisma from '../prismaClient.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = express.Router();

router.post(
  '/vote/:caseId',
  authRequired,
  requireRoles('JUROR'),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseId);
      const { verdict } = req.body;

      if (!['GUILTY', 'NOT_GUILTY'].includes(verdict)) {
        return res.status(400).json({ message: 'Invalid verdict' });
      }

      const courtCase = await prisma.courtCase.findUnique({
        where: { id: caseId },
      });

      if (!courtCase) {
        return res.status(404).json({ message: 'Case not found' });
      }

      if (courtCase.status !== 'APPROVED') {
        return res
          .status(400)
          .json({ message: 'Only approved cases can be voted on' });
      }

      const existing = await prisma.juryVote.findUnique({
        where: {
          caseId_jurorId: {
            caseId,
            jurorId: req.user.id,
          },
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ message: 'You have already voted on this case' });
      }

      await prisma.juryVote.create({
        data: {
          caseId,
          jurorId: req.user.id,
          verdict,
        },
      });

      return res.json({ message: 'Vote recorded' });
    } catch (err) {
      console.error('Vote error', err);
      return res.status(500).json({ message: 'Failed to record vote' });
    }
  }
);

router.get(
  '/results/:caseId',
  authRequired,
  requireRoles('JUDGE', 'JUROR'),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseId);


      if (req.user.role === 'JUROR') {
        const myVote = await prisma.juryVote.findUnique({
          where: {
            caseId_jurorId: {
              caseId,
              jurorId: req.user.id,
            },
          },
        });

        if (!myVote) {
          return res.status(403).json({
            message:
              'You can only view results after casting your vote for this case',
          });
        }
      }

      const votes = await prisma.juryVote.findMany({
        where: { caseId },
      });

      const totalVotes = votes.length;
      const guilty = votes.filter((v) => v.verdict === 'GUILTY').length;
      const notGuilty = votes.filter(
        (v) => v.verdict === 'NOT_GUILTY'
      ).length;

      return res.json({ totalVotes, guilty, notGuilty });
    } catch (err) {
      console.error('Results error', err);
      return res.status(500).json({ message: 'Failed to fetch results' });
    }
  }
);


router.get(
  '/my-votes',
  authRequired,
  requireRoles('JUROR'),
  async (req, res) => {
    try {
      const votes = await prisma.juryVote.findMany({
        where: { jurorId: req.user.id },
        select: {
          caseId: true,
          verdict: true,
        },
      });

      return res.json(votes);
    } catch (err) {
      console.error('My votes error', err);
      return res.status(500).json({ message: 'Failed to load your votes' });
    }
  }
);

export default router;
