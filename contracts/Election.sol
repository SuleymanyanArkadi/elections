// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract Election is AccessControl {
    enum VoterGroup {
        All,
        Group1,
        Group2,
        Group3
    }

    struct Voter {
        bool whitelisted;
        VoterGroup group;
    }

    struct VotingData {
        bytes32 description;
        bytes32[] options;
        mapping(bytes32 => uint256) votesReceived;
        mapping(address => bool) voted;
        VoterGroup group;
        uint256 endTime;
    }

    mapping(address => Voter) public voters;
    mapping(bytes32 => VotingData) public votings;

    event VoterAdded(address indexed voter, VoterGroup indexed group);
    event VoterModified(address indexed voter, VoterGroup indexed group);
    event VoterRemoved(address indexed voter);
    event VotingCreated(bytes32 indexed votingName, VoterGroup indexed group, uint256 indexed endTime);
    event VoteCasted(address indexed voter, bytes32 indexed votingName, bytes32 indexed option);

    modifier votingExist(bytes32 name) {
        require(votings[name].endTime != 0, "Voting does not exist");
        _;
    }

    modifier verifyVoter(bytes32 name, address voter) {
        require(voters[voter].whitelisted, "Voter does not exist");
        require(votings[name].group == voters[voter].group || votings[name].group == VoterGroup.All);
        require(votings[name].voted[voter] == false, "Voter already voted");
        _;
    }

    modifier optionExist(bytes32 name, bytes32 option) {
        bytes32[] memory options = votings[name].options;
        bool isMatch;
        for (uint256 i = 0; i < options.length; i++) {
            if (options[i] == option) isMatch = true;
        }
        require(isMatch, "Option does not exist");
        _;
    }

    constructor(address admin_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    function addVoter(address voter_, VoterGroup group_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!voters[voter_].whitelisted, "Voter already added");

        voters[voter_] = Voter({whitelisted: true, group: group_});

        emit VoterAdded(voter_, group_);
    }

    function modifyVoter(address voter_, VoterGroup newGroup_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(voters[voter_].whitelisted, "Voter does not exist");

        voters[voter_].group = newGroup_;

        emit VoterModified(voter_, newGroup_);
    }

    function removeVoter(address voter_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(voters[voter_].whitelisted, "Voter does not exist");

        delete voters[voter_];

        emit VoterRemoved(voter_);
    }

    function createVoting(
        bytes32 name_,
        uint256 duration_,
        bytes32[] memory options_,
        bytes32 description_,
        VoterGroup group_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(votings[name_].endTime == 0, "Voting topic already exists");
        require(options_.length >= 2, "At least two option is required");

        VotingData storage voting = votings[name_];
        voting.endTime = block.timestamp + duration_;
        voting.group = group_;
        voting.options = options_;
        voting.description = description_;

        emit VotingCreated(name_, group_, block.timestamp + duration_);
    }

    function vote(
        bytes32 votingName_,
        bytes32 voteFor_
    ) external votingExist(votingName_) verifyVoter(votingName_, msg.sender) optionExist(votingName_, voteFor_) {
        VotingData storage voting = votings[votingName_];
        require(voting.endTime >= block.timestamp);

        voting.votesReceived[voteFor_] += 1;
        voting.voted[msg.sender] = true;

        emit VoteCasted(msg.sender, votingName_, voteFor_);
    }

    function getOptions(bytes32 votingName_) external view returns (bytes32[] memory) {
        return votings[votingName_].options;
    }

    function getResults(bytes32 votingName_) external view returns (uint256[] memory) {
        VotingData storage voting = votings[votingName_];

        uint256[] memory results = new uint256[](voting.options.length);
        for (uint256 i = 0; i < voting.options.length; i++) {
            results[i] = voting.votesReceived[voting.options[i]];
        }
        return results;
    }

    function getWinner(bytes32 votingName_) external view returns (bytes32 winner) {
        VotingData storage voting = votings[votingName_];

        uint256 maxVotes;
        for (uint256 i = 0; i < voting.options.length; i++) {
            if (maxVotes < voting.votesReceived[voting.options[i]]) {
                winner = voting.options[i];
            }
        }
    }

    function isVoted(bytes32 votingName_, address voter_) external view returns (bool) {
        return votings[votingName_].voted[voter_];
    }
}
