// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GameMaster is Ownable {
    enum State {
        Waiting,
        InProgress,
        FinishedWithWinner,
        FinishedWithDraw,
        Canceled
    }

    enum Players {
        None,
        PlayerOne,
        PlayerTwo
    }

    /**
     * @notice Info of each match
     * @param gameAddress: Address of the game to be played
     * @param playerOne: First player
     * @param playerTwo: Second player
     * @param state: State of the match
     * @param playerTurn: Whose turn it is
     * @param moveDelay: Maximal delay between moves in blocks
     * @param bid: Bid amount
     * @param lastMoveCheckpoint: Block number of last move
     */
    struct Match {
        address gameAddress;
        address playerOne;
        address playerTwo;
        State state;
        Players playerTurn;
        uint256 moveDelay;
        uint256 bid;
        uint256 lastMoveCheckpoint;
    }

    uint256 public minBid;
    uint256 public matchId;

    mapping(address => string) public makeMoveSignature;
    mapping(uint256 => Match) public matches;

    event MatchCreated(
        uint256 matchId,
        address gameAddress,
        address playerOne,
        address playerTwo,
        uint256 moveDelay,
        uint256 bid
    );

    event NewGameAdded(address newGame);
    event GameDeleted(address game);
    event MatchAccepted(uint256 matchId);
    event MatchFinished(uint256 matchId, address winner);
    event MatchCanceled(uint256 matchId);
    event NewMinBid(uint256 oldMinBid, uint256 newMinBid);

    constructor(uint256 minBid_) {
        minBid = minBid_;
    }

    fallback() external payable {}

    receive() external payable {}

    /**
     * @notice Add new game
     * @param game_: Address of the game
     * @param makeMoveSignature_: makeMove function signature in game contract
     */
    function addGame(address game_, string calldata makeMoveSignature_) external onlyOwner {
        makeMoveSignature[game_] = makeMoveSignature_;

        emit NewGameAdded(game_);
    }

    /**
     * @notice Remove game
     * @param game_: Address of the game
     */
    function removeGame(address game_) external onlyOwner {
        makeMoveSignature[game_] = "";

        emit GameDeleted(game_);
    }

    /**
     * @notice Set new minimal bid
     */
    function setMinBid(uint256 newMinBid_) external onlyOwner {
        emit NewMinBid(minBid, newMinBid_);

        minBid = newMinBid_;
    }

    /**
     * @notice Create new match
     * @param game_: Address of game
     * @param opponent_: Address of second player
     * @param moveDelay_: Maximal delay between moves in blocks
     */
    function newMatch(
        address game_,
        address opponent_,
        uint256 moveDelay_
    ) external payable {
        require(minBid <= msg.value, "Not enough bid");
        require(msg.sender != opponent_, "Same address for players");
        require(bytes(makeMoveSignature[game_]).length != 0, "Game does not exist");

        Match storage match_ = matches[matchId];

        match_.gameAddress = game_;
        match_.playerOne = msg.sender;
        match_.playerTwo = opponent_;
        match_.moveDelay = moveDelay_;
        match_.bid = msg.value;

        emit MatchCreated(matchId, game_, msg.sender, opponent_, moveDelay_, msg.value);

        matchId++;
    }

    /**
     * @notice Accept the match
     * @param matchId_: Id of match to accept
     */
    function acceptMatch(uint256 matchId_) external payable {
        Match storage match_ = matches[matchId_];
        
        require(matchId_ < matchId, "Match does not exist");
        require(match_.playerTwo == msg.sender, "Wrong match");
        require(match_.state == State.Waiting, "Match already accepted");
        require(match_.bid == msg.value, "Wrong bid");

        match_.state = State.InProgress;
        match_.playerTurn = Players.PlayerOne;
        match_.lastMoveCheckpoint = block.number;

        emit MatchAccepted(matchId_);
    }

    /**
     * @notice Cancel the match while it's still pending to accept
     * @param matchId_: Id of match to cancel
     */
    function cancelMatch(uint256 matchId_) external {
        Match storage match_ = matches[matchId_];

        require(match_.playerOne == msg.sender, "Player did not create this match");
        require(match_.state == State.Waiting, "Match already started or finished");

        match_.state = State.Canceled;

        emit MatchCanceled(matchId_);

        payable(msg.sender).transfer(match_.bid);
    }

    /**
     * @notice Make move
     * @param matchId_: Id of match to make move
     * @param params_: Contains parameters for game contract makeMove function
     */
    function makeMove(uint256 matchId_, uint256[] calldata params_) external {
        checksBeforeMove(matchId_);

        Match storage match_ = matches[matchId_];

        //slither-disable-next-line low-level-calls,reentrancy-no-eth,reentrancy-events
        (bool success, bytes memory data) = match_.gameAddress.call(
            abi.encodeWithSignature(makeMoveSignature[match_.gameAddress], match_.playerTurn, matchId_, params_)
        );

        require(success, "MakeMove call failed");

        match_.lastMoveCheckpoint = block.number;
        uint256 res = abi.decode(data, (uint256));

        if (res == 1) {
            executeDraw(matchId_);
            return;
        } else if (res == 2) {
            executeWin(matchId_, getCurrentPlayer(matchId_));
            return;
        }

        nextPlayer(matchId_);
    }

    /**
     * @notice End the match when the opponent's turn time is up
     * @param matchId_: Id of match to finish
     */
    function finishExpiredMatch(uint256 matchId_) external {
        Match storage match_ = matches[matchId_];

        require(match_.state == State.InProgress, "Match should be in progress");
        require(match_.lastMoveCheckpoint + match_.moveDelay < block.number, "Match has not yet expired");

        nextPlayer(matchId_);
        executeWin(matchId_, getCurrentPlayer(matchId_));
    }

    /**
     * @notice Function to execute draw. Finish the match and send players bids back
     * @param matchId_: Id of match to finish
     */
    function executeDraw(uint256 matchId_) private {
        Match storage match_ = matches[matchId_];

        match_.state = State.FinishedWithDraw;

        emit MatchFinished(matchId_, address(0));

        payable(match_.playerOne).transfer(match_.bid);
        payable(match_.playerTwo).transfer(match_.bid);
    }

    /**
     * @notice Function to execute win. Finish the match and send players bids to winner
     * @param matchId_: Id of match to finish
     * @param winner_: Winner address
     */
    function executeWin(uint256 matchId_, address winner_) private {
        matches[matchId_].state = State.FinishedWithWinner;

        emit MatchFinished(matchId_, winner_);

        payable(winner_).transfer(matches[matchId_].bid * 2);
    }

    /**
     * @notice Function to change players turn
     * @param matchId_: Id of match
     */
    function nextPlayer(uint256 matchId_) private {
        Match storage match_ = matches[matchId_];

        if (match_.playerTurn == Players.PlayerOne) {
            match_.playerTurn = Players.PlayerTwo;
        } else {
            match_.playerTurn = Players.PlayerOne;
        }
    }

    /**
     * @notice Function to check that user can make move
     * @param matchId_: Id of match
     */
    function checksBeforeMove(uint256 matchId_) private view {
        Match storage match_ = matches[matchId_];

        require(match_.lastMoveCheckpoint + match_.moveDelay >= block.number, "Match expired");
        require(match_.playerTurn != Players.None, "Match hasn't started yet");
        require(match_.state == State.InProgress, "Match already ended");

        address player = getCurrentPlayer(matchId_);
        require(player == msg.sender, "Another player's move");
    }

    /**
     * @notice Function to find out whose move
     * @param matchId_: Id of match
     */
    function getCurrentPlayer(uint256 matchId_) private view returns (address) {
        if (matches[matchId_].playerTurn == Players.PlayerOne) {
            return matches[matchId_].playerOne;
        }

        return matches[matchId_].playerTwo;
    }
}
