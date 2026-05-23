/** Ordered pair so each duo has one conversation row (user_a_id < user_b_id). */
export function orderedPair(id1, id2) {
  const a = Number(id1);
  const b = Number(id2);
  return a < b ? [a, b] : [b, a];
}

export function otherParticipantId(conversation, userId) {
  const uid = Number(userId);
  return conversation.user_a_id === uid ? conversation.user_b_id : conversation.user_a_id;
}
